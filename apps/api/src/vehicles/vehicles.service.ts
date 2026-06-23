import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  isAllowedDocumentMimeType,
  isWithinLimit,
  MAX_DOCUMENT_SIZE_BYTES,
  PLAN_LIMITS,
  PlanTier,
  type VehicleRegistrationResult,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';
import { OCR_PROVIDER } from '../ocr/ocr.provider';
import type { OcrProvider } from '../ocr/ocr.provider';
import { VEHICLE_EXTRACTION_PROVIDER } from '../extraction/vehicle-extraction.provider';
import type { VehicleExtractionProvider } from '../extraction/vehicle-extraction.provider';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { ConfirmScanDto } from './dto/confirm-scan.dto';

/** Egy feltöltött fájl (multer memory storage). */
export interface UploadedScanFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Egy beolvasott (staging) fájl leírója – a confirm ezzel köti a járműhöz. */
export interface ScanFileRef {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface VehicleScanResult {
  draft: VehicleRegistrationResult;
  files: ScanFileRef[];
  /** Ha a rendszám/VIN már létező járműre illik (frissítés ajánlott). */
  matchedVehicleId: string | null;
}

/** A jármű-scan staging S3 prefixe (a confirm csak ezen belüli kulcsot fogad el). */
const SCAN_PREFIX = 'vehicle-scans';

/**
 * Jármű CRUD + forgalmi-engedély beolvasás (OCR + AI). A Vehicle modell
 * tenant-scope-olt; a scoped kliens szűri/tölti a tenantId-t.
 */
@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(VEHICLE_EXTRACTION_PROVIDER)
    private readonly vehicleExtraction: VehicleExtractionProvider,
  ) {}

  list() {
    return this.prisma.scoped.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id },
    });
    if (!vehicle) {
      throw AppException.notFound('A jármű nem található.');
    }
    return vehicle;
  }

  /**
   * Jármű szerviztörténete: minden hozzárendelt számlatétel a számla
   * metaadataival (dátum, beszállító, számlaszám), valamint összegzés
   * (összköltség, tétel- és számlaszám, utolsó szerviz dátuma).
   */
  async getServiceHistory(id: string) {
    const vehicle = await this.getById(id); // tenant-scope-olt létezés-ellenőrzés

    const items = await this.prisma.scoped.invoiceItem.findMany({
      where: { vehicleId: id },
      include: {
        invoice: {
          select: {
            id: true,
            documentId: true,
            invoiceNumber: true,
            date: true,
            currency: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Összegzés + legutóbbi szerviz dátuma.
    let totalSpent = new Prisma.Decimal(0);
    let lastServiceDate: Date | null = null;
    const invoiceIds = new Set<string>();
    let currency: string | null = null;
    for (const item of items) {
      totalSpent = totalSpent.add(item.price);
      invoiceIds.add(item.invoiceId);
      const date = item.invoice?.date ?? null;
      if (date && (!lastServiceDate || date > lastServiceDate)) {
        lastServiceDate = date;
      }
      if (!currency && item.invoice?.currency) currency = item.invoice.currency;
    }

    // Legújabb szerviz elöl (számla dátuma, majd a tétel létrehozása szerint).
    const sorted = [...items].sort((a, b) => {
      const da = a.invoice?.date ? new Date(a.invoice.date).getTime() : 0;
      const db = b.invoice?.date ? new Date(b.invoice.date).getTime() : 0;
      if (db !== da) return db - da;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      vehicle,
      summary: {
        totalSpent: totalSpent.toString(),
        itemCount: items.length,
        invoiceCount: invoiceIds.size,
        lastServiceDate,
        currency,
      },
      items: sorted,
    };
  }

  async create(tenantId: string, userId: string, dto: CreateVehicleDto) {
    await this.assertVehicleLimit(tenantId);

    const vehicle = await this.prisma.scoped.vehicle.create({
      // tenantId-t a scoped kliens is injektálja; explicit átadjuk a típus-
      // biztonságért (az érték azonos, így nincs ütközés).
      data: {
        tenantId,
        plate: dto.plate ?? null,
        vin: dto.vin ?? null,
        make: dto.make ?? null,
        model: dto.model ?? null,
        year: dto.year ?? null,
        odometerKm: dto.odometerKm ?? null,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.created',
      resourceType: 'Vehicle',
      resourceId: vehicle.id,
    });

    return vehicle;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateVehicleDto,
  ) {
    await this.getById(id); // tenant-scope-olt létezés-ellenőrzés

    const vehicle = await this.prisma.scoped.vehicle.update({
      where: { id },
      data: {
        plate: dto.plate,
        vin: dto.vin,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        odometerKm: dto.odometerKm,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.updated',
      resourceType: 'Vehicle',
      resourceId: id,
    });

    return vehicle;
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    await this.getById(id);

    // A járműhöz tartozó tárolt fájlok kulcsai (a DB cascade törli a sorokat,
    // de az S3 fájlt expliciten kell takarítani).
    const docs = await this.prisma.scoped.vehicleDocument.findMany({
      where: { vehicleId: id },
      select: { storageKey: true },
    });

    await this.prisma.scoped.vehicle.delete({ where: { id } });

    // Best-effort tárhely-takarítás (a jármű DB-ből már törlődött).
    for (const doc of docs) {
      try {
        await this.storage.delete(doc.storageKey);
      } catch (err) {
        this.logger.warn(
          `Jármű-dokumentum fájl törlése sikertelen (${doc.storageKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.deleted',
      resourceType: 'Vehicle',
      resourceId: id,
    });
  }

  // ── Forgalmi engedély beolvasás (OCR + AI) ──────────────────────────────────

  /**
   * Forgalmi engedély (1–2 kép vagy PDF) beolvasása: feltöltés a staging
   * tárhelyre → OCR → AI kiolvasás → draft mezők. NEM ment járművet; a felhasználó
   * az ellenőrzött adatokkal a `confirmScan`-t hívja. Ha a rendszám/VIN már létező
   * járműre illik, a `matchedVehicleId` frissítést javasol.
   */
  async scanRegistration(
    tenantId: string,
    userId: string,
    files: UploadedScanFile[] | undefined,
    locale?: string,
  ): Promise<VehicleScanResult> {
    if (!files || files.length === 0) {
      throw AppException.validation('Hiányzik a beolvasandó fájl.');
    }

    const scanId = randomUUID();
    const staged: ScanFileRef[] = [];
    const texts: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const mimeType = file.mimetype || 'application/octet-stream';
      if (!isAllowedDocumentMimeType(mimeType)) {
        throw AppException.unsupportedDocumentType();
      }
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        throw AppException.documentTooLarge();
      }

      const storageKey = `tenants/${tenantId}/${SCAN_PREFIX}/${scanId}/${i}`;
      await this.storage.upload(storageKey, file.buffer, mimeType);

      const ocr = await this.ocr.recognize({
        storageKey,
        mimeType,
        tenantId,
        documentId: scanId,
      });
      texts.push(ocr.text);
      staged.push({
        storageKey,
        fileName: file.originalname,
        mimeType,
        sizeBytes: file.size,
      });
    }

    const draft = await this.vehicleExtraction.extractVehicle(
      texts.join('\n\n'),
      { tenantId, locale },
    );

    const matchedVehicleId = await this.findMatchingVehicle(
      draft.plate,
      draft.vin,
    );

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.scanned',
      resourceType: 'Vehicle',
      metadata: {
        fileCount: files.length,
        confidence: draft.confidence,
        matchedVehicleId,
      },
    });

    return { draft, files: staged, matchedVehicleId };
  }

  /**
   * A beolvasott (ellenőrzött) adatok mentése: új jármű létrehozása, vagy meglévő
   * frissítése (`vehicleId`), majd a beolvasott fájl(ok) hozzákötése a jármű
   * dokumentum-archívumához. A staging kulcsokat a tenant-prefix ELLENŐRZÉSE
   * védi (idegen kulcs nem köthető be).
   */
  async confirmScan(
    tenantId: string,
    userId: string,
    dto: ConfirmScanDto,
  ): Promise<{ id: string }> {
    const allowedPrefix = `tenants/${tenantId}/${SCAN_PREFIX}/`;
    for (const f of dto.files ?? []) {
      if (!f.storageKey.startsWith(allowedPrefix)) {
        throw AppException.forbidden('Érvénytelen fájlhivatkozás.');
      }
    }

    const fields: CreateVehicleDto = {
      plate: dto.plate,
      vin: dto.vin,
      make: dto.make,
      model: dto.model,
      year: dto.year,
      odometerKm: dto.odometerKm,
    };

    const vehicle = dto.vehicleId
      ? await this.update(tenantId, userId, dto.vehicleId, fields)
      : await this.create(tenantId, userId, fields);

    if (dto.files && dto.files.length > 0) {
      await this.prisma.scoped.vehicleDocument.createMany({
        data: dto.files.map((f) => ({
          tenantId,
          vehicleId: vehicle.id,
          kind: 'registration',
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          storageKey: f.storageKey,
        })),
      });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.scan_confirmed',
      resourceType: 'Vehicle',
      resourceId: vehicle.id,
      metadata: { documentCount: dto.files?.length ?? 0, updated: !!dto.vehicleId },
    });

    return { id: vehicle.id };
  }

  /** Egy jármű csatolt dokumentumai (archívum). */
  async listDocuments(vehicleId: string) {
    await this.getById(vehicleId); // tenant-scope-olt létezés-ellenőrzés
    return this.prisma.scoped.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
  }

  /** Presigned letöltési URL egy jármű-dokumentumhoz. */
  async getDocumentDownloadUrl(
    vehicleId: string,
    docId: string,
  ): Promise<{ downloadUrl: string }> {
    const doc = await this.prisma.scoped.vehicleDocument.findFirst({
      where: { id: docId, vehicleId },
      select: { storageKey: true },
    });
    if (!doc) throw AppException.notFound('A dokumentum nem található.');
    const downloadUrl = await this.storage.presignGet(doc.storageKey);
    return { downloadUrl };
  }

  /** Rendszám/VIN alapú egyezés a meglévő járművekkel (frissítés-javaslathoz). */
  private async findMatchingVehicle(
    plate: string | null,
    vin: string | null,
  ): Promise<string | null> {
    const normPlate = plate ? normalizePlate(plate) : '';
    const normVin = vin ? normalizeVin(vin) : '';
    if (!normPlate && !normVin) return null;

    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: { id: true, plate: true, vin: true },
    });
    for (const v of vehicles) {
      if (normVin && v.vin && normalizeVin(v.vin) === normVin) return v.id;
      if (normPlate && v.plate && normalizePlate(v.plate) === normPlate)
        return v.id;
    }
    return null;
  }

  /** Csomag jármű-limit ellenőrzése a létrehozás előtt. */
  private async assertVehicleLimit(tenantId: string): Promise<void> {
    const subscription = await this.prisma.system.subscription.findUnique({
      where: { tenantId },
      select: { planTier: true },
    });
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limit = PLAN_LIMITS[planTier].maxVehicles;

    const count = await this.prisma.scoped.vehicle.count();
    if (!isWithinLimit(count, limit)) {
      throw AppException.vehiclesLimitReached();
    }
  }
}

/** Rendszám normalizálása: csak betűk/számok, nagybetű (pl. "ABC-123" → "ABC123"). */
function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** VIN normalizálása: nagybetű, szóközök eltávolítva. */
function normalizeVin(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}
