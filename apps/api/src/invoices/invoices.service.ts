import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import {
  DocumentStatus,
  DocumentType,
  ItemCategory,
  ItemType,
  MANUAL_DOCUMENT_MIME_TYPE,
} from '@valloreg/shared';
import { normalizePartKey } from '../matching/matching.util';
import type { UpdateInvoiceItemDto } from './dto/update-invoice-item.dto';
import type { AddInvoiceItemDto } from './dto/add-invoice-item.dto';
import type { CreateManualInvoiceDto } from './dto/create-manual-invoice.dto';

/**
 * Számla olvasás és tételszintű felülbírálás. Az Invoice/InvoiceItem
 * tenant-scope-olt; a scoped kliens szűr.
 *
 * A review során a felhasználó járművet rendelhet a tételekhez és javíthatja a
 * kategóriát/típust. A jármű-hozzárendelés egyúttal a tanuló mappinget
 * (SupplierVehicleMapping) is súlyozza, hogy a jövőbeli automatikus
 * hozzárendelés pontosabb legyen.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Egy számla a tételeivel, dokumentum-azonosító alapján. */
  async getByDocumentId(documentId: string) {
    const invoice = await this.prisma.scoped.invoice.findFirst({
      where: { documentId },
      include: { items: true, supplier: true },
    });
    if (!invoice) {
      throw AppException.notFound(
        'Ehhez a dokumentumhoz még nincs feldolgozott számla.',
      );
    }
    return invoice;
  }

  /** Egy számla a tételeivel, számla-azonosító alapján. */
  async getById(invoiceId: string) {
    const invoice = await this.prisma.scoped.invoice.findFirst({
      where: { id: invoiceId },
      include: { items: true, supplier: true },
    });
    if (!invoice) {
      throw AppException.notFound('A számla nem található.');
    }
    return invoice;
  }

  /**
   * Egy számlatétel felülbírálása (jármű-hozzárendelés, kategória, típus).
   * Jármű-hozzárendeléskor a beszállító→jármű tanuló mappinget is súlyozza.
   */
  async updateItem(
    tenantId: string,
    userId: string,
    itemId: string,
    dto: UpdateInvoiceItemDto,
  ) {
    const item = await this.prisma.scoped.invoiceItem.findFirst({
      where: { id: itemId },
      include: { invoice: { select: { supplierId: true } } },
    });
    if (!item) {
      throw AppException.notFound('A számlatétel nem található.');
    }

    // Jármű-hozzárendeléskor ellenőrizzük, hogy a jármű létezik (tenant-scope).
    if (dto.vehicleId) {
      const vehicle = await this.prisma.scoped.vehicle.findFirst({
        where: { id: dto.vehicleId },
        select: { id: true },
      });
      if (!vehicle) {
        throw AppException.notFound('A jármű nem található.');
      }
    }

    // Csak a megadott mezőket frissítjük (undefined = változatlan, null = törlés).
    const data: Prisma.InvoiceItemUncheckedUpdateInput = {};
    if (dto.vehicleId !== undefined) data.vehicleId = dto.vehicleId;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.partType !== undefined) data.partType = dto.partType;

    const updated = await this.prisma.scoped.invoiceItem.update({
      where: { id: itemId },
      data,
    });

    // Tanulás: ha járművet rendeltünk és ismert a beszállító, súlyozzuk a mappinget.
    if (dto.vehicleId && item.invoice.supplierId) {
      await this.recordSupplierVehicleMapping(
        tenantId,
        item.invoice.supplierId,
        dto.vehicleId,
      );
    }

    // Tanulás: kategória/típus felülbíráláskor a tétel-minta → kategória mappinget
    // súlyozzuk, hogy a jövőbeli automatikus kategorizálás pontosabb legyen.
    if (dto.category !== undefined || dto.type !== undefined) {
      await this.recordItemCategoryMapping(
        tenantId,
        item.invoice.supplierId,
        item.name,
        updated.category,
        updated.type,
      );
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'invoice_item.updated',
      resourceType: 'InvoiceItem',
      resourceId: itemId,
      metadata: {
        vehicleId: dto.vehicleId ?? null,
        category: dto.category,
        type: dto.type,
        partType: dto.partType ?? null,
      },
    });

    return updated;
  }

  /**
   * Kézi számlatétel hozzáadása (tipikusan MUNKADÍJ). A `price` a tétel teljes
   * összege; alapból `labor` kategória és `vehicle` típus. A confidence 1
   * (kézi rögzítés). A riportok a tételek `price`-át összegzik, így a munkadíj
   * automatikusan megjelenik a költségekben.
   */
  async addItem(
    tenantId: string,
    userId: string,
    invoiceId: string,
    dto: AddInvoiceItemDto,
  ) {
    const invoice = await this.prisma.scoped.invoice.findFirst({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw AppException.notFound('A számla nem található.');
    }

    if (dto.vehicleId) {
      const vehicle = await this.prisma.scoped.vehicle.findFirst({
        where: { id: dto.vehicleId },
        select: { id: true },
      });
      if (!vehicle) {
        throw AppException.notFound('A jármű nem található.');
      }
    }

    const quantity = dto.quantity ?? 1;
    const price = new Prisma.Decimal(dto.price);
    const unitPrice =
      dto.unitPrice != null
        ? new Prisma.Decimal(dto.unitPrice)
        : quantity > 0
          ? price.div(quantity)
          : price;

    const created = await this.prisma.scoped.invoiceItem.create({
      data: {
        tenantId,
        invoiceId,
        name: dto.name,
        category: dto.category ?? ItemCategory.LABOR,
        type: dto.type ?? ItemType.VEHICLE,
        partType: dto.partType ?? null,
        vehicleId: dto.vehicleId ?? null,
        quantity,
        unitPrice,
        price,
        confidence: 1,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'invoice_item.added',
      resourceType: 'InvoiceItem',
      resourceId: created.id,
      metadata: {
        invoiceId,
        category: created.category,
        vehicleId: dto.vehicleId ?? null,
      },
    });

    return created;
  }

  /**
   * KÉZI javítás-/költségrögzítés SZÁMLA NÉLKÜL. Olyan javításokhoz, amikhez nem
   * érkezik számla (pl. helyben végzett, készpénzes munka). Egy „manuális"
   * Document (fájl nélkül, CONFIRMED) + Invoice + tételek jön létre, így a
   * szerviztörténet, a riportok és a TCO automatikusan tartalmazzák. Az alkatrész
   * és a munkadíj KÜLÖN tételként vihető be (a category/type különbözteti meg).
   */
  async createManual(
    tenantId: string,
    userId: string,
    dto: CreateManualInvoiceDto,
  ): Promise<{ documentId: string; invoiceId: string }> {
    if (dto.vehicleId) {
      const vehicle = await this.prisma.scoped.vehicle.findFirst({
        where: { id: dto.vehicleId },
        select: { id: true },
      });
      if (!vehicle) throw AppException.notFound('A jármű nem található.');
    }

    const supplierId = dto.supplier
      ? await this.resolveSupplierScoped(tenantId, dto.supplier)
      : null;

    // Tételek normalizálása: ár/egységár kiszámítása, partKey képzése.
    const items = dto.items.map((it) => {
      const quantity = it.quantity ?? 1;
      const category = it.category ?? ItemCategory.PART;
      const type = it.type ?? ItemType.VEHICLE;
      const price =
        it.price != null
          ? it.price
          : it.unitPrice != null
            ? it.unitPrice * quantity
            : 0;
      const unitPrice =
        it.unitPrice != null
          ? it.unitPrice
          : quantity > 0
            ? price / quantity
            : price;
      // Jármű-tételt a kiválasztott járműhöz kötjük; szerszám/általános nem.
      const vehicleId = type === ItemType.VEHICLE ? (dto.vehicleId ?? null) : null;
      return {
        name: it.name,
        category,
        type,
        partType: it.partType ?? null,
        articleNumber: it.articleNumber ?? null,
        partKey: normalizePartKey(it.articleNumber ?? null, it.partType ?? null, it.name),
        vehicleId,
        quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
        price: new Prisma.Decimal(price),
        confidence: 1,
      };
    });

    const grossTotal = items.reduce(
      (sum, it) => sum.add(it.price),
      new Prisma.Decimal(0),
    );
    const date = dto.date ? new Date(dto.date) : new Date();
    const dateLabel = date.toISOString().slice(0, 10);
    // A fájlnév adat (nem i18n): a kliens által adott cím, vagy a beszállító/dátum.
    const fileName =
      dto.title?.trim() ||
      (dto.supplier ? `${dto.supplier} – ${dateLabel}` : `Manual – ${dateLabel}`);
    // Egyedi sha256 (nincs fájl): a (tenantId, sha256) unique kulcs kielégítéséhez.
    const sha256 = createHash('sha256').update(randomUUID()).digest('hex');

    const result = await this.prisma.scoped.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId,
          uploadedById: userId,
          fileName,
          mimeType: MANUAL_DOCUMENT_MIME_TYPE,
          sizeBytes: 0,
          storageKey: '',
          sha256,
          status: DocumentStatus.CONFIRMED,
          docType: DocumentType.INVOICE,
        },
        select: { id: true },
      });

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          documentId: document.id,
          supplierId,
          invoiceNumber: dto.invoiceNumber || null,
          date,
          currency: dto.currency || 'RON',
          odometerKm: dto.odometerKm ?? null,
          grossTotal,
          confidence: 1,
        },
        select: { id: true },
      });

      await tx.invoiceItem.createMany({
        data: items.map((it) => ({ tenantId, invoiceId: invoice.id, ...it })),
      });

      return { documentId: document.id, invoiceId: invoice.id };
    });

    // Tanulás: ha jármű + beszállító is van, súlyozzuk a mappinget.
    if (supplierId && dto.vehicleId) {
      await this.recordSupplierVehicleMapping(tenantId, supplierId, dto.vehicleId);
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'invoice.manual_created',
      resourceType: 'Invoice',
      resourceId: result.invoiceId,
      metadata: {
        documentId: result.documentId,
        vehicleId: dto.vehicleId ?? null,
        itemCount: items.length,
        grossTotal: grossTotal.toString(),
      },
    });

    return result;
  }

  /** Egy számlatétel törlése (kézi korrekció). Tenant-scope-olt. */
  async deleteItem(tenantId: string, userId: string, itemId: string) {
    const item = await this.prisma.scoped.invoiceItem.findFirst({
      where: { id: itemId },
      select: { id: true },
    });
    if (!item) {
      throw AppException.notFound('A számlatétel nem található.');
    }

    await this.prisma.scoped.invoiceItem.delete({ where: { id: itemId } });

    await this.audit.log({
      tenantId,
      userId,
      action: 'invoice_item.deleted',
      resourceType: 'InvoiceItem',
      resourceId: itemId,
    });

    return { id: itemId };
  }

  /**
   * Beszállító feloldása/létrehozása normalizált név alapján (tenant-scope).
   * Üres név → null. A kézi rögzítéshez kell (a worker MatchingService-éhez
   * hasonló, de a scoped kliensen, request-kontextusban).
   */
  private async resolveSupplierScoped(
    tenantId: string,
    name: string,
  ): Promise<string | null> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return null;
    const normalizedName = trimmed.toLowerCase().replace(/\s+/g, ' ').trim();

    const existing = await this.prisma.scoped.supplier.findFirst({
      where: { normalizedName },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.scoped.supplier.create({
      data: { tenantId, name: trimmed, normalizedName },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Beszállító→jármű tanuló mapping súlyozása. Ha létezik, +1 a súly, különben
   * új sor. A scoped kliens a tenant-szűrést automatikusan elvégzi.
   */
  private async recordSupplierVehicleMapping(
    tenantId: string,
    supplierId: string,
    vehicleId: string,
  ): Promise<void> {
    const existing = await this.prisma.scoped.supplierVehicleMapping.findFirst({
      where: { supplierId, vehicleId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.scoped.supplierVehicleMapping.update({
        where: { id: existing.id },
        data: { weight: { increment: 1 } },
      });
    } else {
      await this.prisma.scoped.supplierVehicleMapping.create({
        data: { tenantId, supplierId, vehicleId },
      });
    }
  }

  /**
   * Tétel-minta → kategória/típus tanuló mapping súlyozása. A `pattern` a tétel
   * normalizált neve; beszállítóhoz kötve (ha ismert), hogy beszállító-specifikus
   * legyen a tanulás. Ha létezik, +1 a súly, különben új sor.
   */
  private async recordItemCategoryMapping(
    tenantId: string,
    supplierId: string | null,
    name: string,
    category: string,
    type: string,
  ): Promise<void> {
    const pattern = name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!pattern) return;

    const existing = await this.prisma.scoped.itemCategoryMapping.findFirst({
      where: { pattern, category, type, supplierId: supplierId ?? null },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.scoped.itemCategoryMapping.update({
        where: { id: existing.id },
        data: { weight: { increment: 1 } },
      });
    } else {
      await this.prisma.scoped.itemCategoryMapping.create({
        data: { tenantId, supplierId: supplierId ?? null, pattern, category, type },
      });
    }
  }
}
