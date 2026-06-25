import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { UpdateInvoiceItemDto } from './dto/update-invoice-item.dto';

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
      try {
        await this.prisma.scoped.supplierVehicleMapping.create({
          data: { tenantId, supplierId, vehicleId },
        });
      } catch (err) {
        // TOCTOU: párhuzamos ág már létrehozta ugyanezt a párost
        // (@@unique[tenantId,supplierId,vehicleId] → P2002). A vesztő ág a
        // meglévő sor súlyát növeli, hogy a tanulás ne vesszen el.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          await this.prisma.scoped.supplierVehicleMapping.updateMany({
            where: { supplierId, vehicleId },
            data: { weight: { increment: 1 } },
          });
        } else {
          throw err;
        }
      }
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
