import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ComplianceType,
  isAllowedDocumentMimeType,
  MAX_DOCUMENT_SIZE_BYTES,
  ReminderKind,
  ReminderType,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';
import { OCR_PROVIDER } from '../ocr/ocr.provider';
import type { OcrProvider } from '../ocr/ocr.provider';
import { COMPLIANCE_EXTRACTION_PROVIDER } from '../extraction/compliance-extraction.provider';
import type { ComplianceExtractionProvider } from '../extraction/compliance-extraction.provider';
import {
  VEHICLE_VERIFICATION_PROVIDER,
  type VehicleVerificationData,
  type VehicleVerificationProvider,
} from './verification.provider';

/** Egy beolvasott (staging) fájl leírója – a confirm ezzel köti a járműhöz. */
export interface VerifyScanFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ComplianceScanResult {
  type: ComplianceType;
  validUntil: string | null;
  confidence: number;
  file: VerifyScanFile;
}

const SCAN_PREFIX = 'vehicle-scans';

/** Megfelelőség-típus → emlékeztető-típus és VehicleVerification mező. */
const COMPLIANCE_TO_REMINDER: Record<ComplianceType, ReminderType> = {
  itp: ReminderType.INSPECTION,
  rca: ReminderType.INSURANCE,
  vignette: ReminderType.VIGNETTE,
};
const COMPLIANCE_TO_FIELD: Record<
  ComplianceType,
  'itpValidUntil' | 'rcaValidUntil' | 'vignetteValidUntil'
> = {
  itp: 'itpValidUntil',
  rca: 'rcaValidUntil',
  vignette: 'vignetteValidUntil',
};

export interface VerificationView {
  source: string;
  status: string;
  itpValidUntil: string | null;
  rcaValidUntil: string | null;
  vignetteValidUntil: string | null;
  checkedAt: string;
}

/** A lejárat-mező → emlékeztető-típus leképezés. */
const FIELD_TO_TYPE: {
  field: keyof Pick<
    VehicleVerificationData,
    'itpValidUntil' | 'rcaValidUntil' | 'vignetteValidUntil'
  >;
  type: ReminderType;
}[] = [
  { field: 'itpValidUntil', type: ReminderType.INSPECTION },
  { field: 'rcaValidUntil', type: ReminderType.INSURANCE },
  { field: 'vignetteValidUntil', type: ReminderType.VIGNETTE },
];

/**
 * RO megfelelőség-ellenőrzés (ITP/RCA/rovinietă). A providertől kapott
 * lejáratokat eltárolja (VehicleVerification) és AUTOMATIKUSAN feltölti a
 * megfelelő compliance emlékeztetők lejáratát (source="verification"), amelyekre
 * a meglévő napi szkenner küld push/e-mail értesítést.
 *
 * Minden írás a SYSTEM klienssel, EXPLICIT tenantId-vel megy (a háttér-ütemező
 * nincs request-kontextusban; a manuális hívásnál a controller adja a tenantId-t).
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(VEHICLE_VERIFICATION_PROVIDER)
    private readonly provider: VehicleVerificationProvider,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(COMPLIANCE_EXTRACTION_PROVIDER)
    private readonly complianceExtraction: ComplianceExtractionProvider,
  ) {}

  // ── Dokumentum-alapú lekérés (API nélkül, OCR-rel) ───────────────────────────

  /**
   * ITP/RCA/rovinietă igazolás beolvasása: staging feltöltés → OCR → lejárat
   * kiolvasása. NEM ment – a draftot adja vissza ellenőrzésre.
   */
  async scanDocument(
    tenantId: string,
    type: ComplianceType,
    file:
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined,
  ): Promise<ComplianceScanResult> {
    if (!file?.buffer?.length) {
      throw AppException.validation('Hiányzik a beolvasandó fájl.');
    }
    const mimeType = file.mimetype || 'application/octet-stream';
    if (!isAllowedDocumentMimeType(mimeType)) {
      throw AppException.unsupportedDocumentType();
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw AppException.documentTooLarge();
    }

    const scanId = randomUUID();
    const storageKey = `tenants/${tenantId}/${SCAN_PREFIX}/${scanId}/0`;
    await this.storage.upload(storageKey, file.buffer, mimeType);

    const ocr = await this.ocr.recognize({
      storageKey,
      mimeType,
      tenantId,
      documentId: scanId,
    });
    const extracted = await this.complianceExtraction.extractCompliance(
      ocr.text,
      { tenantId, expectedType: type },
    );

    return {
      type,
      validUntil: extracted.validUntil,
      confidence: extracted.confidence,
      file: {
        storageKey,
        fileName: file.originalname,
        mimeType,
        sizeBytes: file.size,
      },
    };
  }

  /**
   * A beolvasott (ellenőrzött) lejárat mentése: emlékeztető beállítása, a
   * VehicleVerification adott mezőjének frissítése, és a dokumentum archiválása.
   */
  async confirmDocument(
    tenantId: string,
    userId: string,
    vehicleId: string,
    type: ComplianceType,
    validUntil: string,
    file: VerifyScanFile,
  ): Promise<VerificationView | null> {
    const vehicle = await this.prisma.system.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      select: { id: true },
    });
    if (!vehicle) throw AppException.notFound('A jármű nem található.');

    if (!file.storageKey.startsWith(`tenants/${tenantId}/${SCAN_PREFIX}/`)) {
      throw AppException.forbidden('Érvénytelen fájlhivatkozás.');
    }
    const due = new Date(validUntil);
    if (isNaN(due.getTime())) {
      throw AppException.validation('Érvénytelen lejárati dátum.');
    }

    // 1) Emlékeztető beállítása (a típushoz tartozó compliance emlékeztető).
    const reminderType = COMPLIANCE_TO_REMINDER[type];
    const existing = await this.prisma.system.reminder.findFirst({
      where: {
        tenantId,
        vehicleId,
        type: reminderType,
        kind: ReminderKind.COMPLIANCE,
      },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.system.reminder.updateMany({
        where: { id: existing.id, tenantId },
        data: {
          dueDate: due,
          active: true,
          source: 'document',
          notifiedStage: null,
          lastNotifiedAt: null,
        },
      });
    } else {
      await this.prisma.system.reminder.create({
        data: {
          tenantId,
          vehicleId,
          kind: ReminderKind.COMPLIANCE,
          type: reminderType,
          source: 'document',
          dueDate: due,
          intervalDays: 365,
        },
      });
    }

    // 2) VehicleVerification adott mezőjének frissítése (cache/megjelenítés).
    const field = COMPLIANCE_TO_FIELD[type];
    await this.prisma.system.vehicleVerification.upsert({
      where: { vehicleId },
      create: {
        tenantId,
        vehicleId,
        source: 'document',
        status: 'ok',
        [field]: due,
      },
      update: { source: 'document', status: 'ok', checkedAt: new Date(), [field]: due },
    });

    // 3) Dokumentum archiválása a járműhöz.
    await this.prisma.system.vehicleDocument.create({
      data: {
        tenantId,
        vehicleId,
        kind: type,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storageKey: file.storageKey,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.compliance_document',
      resourceType: 'Vehicle',
      resourceId: vehicleId,
      metadata: { type, validUntil },
    });

    return this.getLatest(vehicleId);
  }

  /** Egy jármű manuális ellenőrzése (tenant-scope-olt létezés-ellenőrzéssel). */
  async verify(
    tenantId: string,
    userId: string,
    vehicleId: string,
  ): Promise<VerificationView> {
    const vehicle = await this.prisma.system.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      select: { id: true, plate: true, vin: true },
    });
    if (!vehicle) throw AppException.notFound('A jármű nem található.');

    const view = await this.doVerify(tenantId, vehicle);

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.verified',
      resourceType: 'Vehicle',
      resourceId: vehicleId,
      metadata: { status: view.status, source: view.source },
    });

    return view;
  }

  /** A legutóbbi ellenőrzés eredménye (scoped olvasás). */
  async getLatest(vehicleId: string): Promise<VerificationView | null> {
    const v = await this.prisma.scoped.vehicleVerification.findFirst({
      where: { vehicleId },
    });
    if (!v) return null;
    return {
      source: v.source,
      status: v.status,
      itpValidUntil: v.itpValidUntil?.toISOString() ?? null,
      rcaValidUntil: v.rcaValidUntil?.toISOString() ?? null,
      vignetteValidUntil: v.vignetteValidUntil?.toISOString() ?? null,
      checkedAt: v.checkedAt.toISOString(),
    };
  }

  /** Háttér-ütemező: minden RO-rendszámú jármű ellenőrzése. */
  async verifyAllRo(): Promise<{ checked: number }> {
    const vehicles = await this.prisma.system.vehicle.findMany({
      select: { id: true, tenantId: true, plate: true, vin: true },
    });
    let checked = 0;
    for (const v of vehicles) {
      if (!isRoPlate(v.plate)) continue;
      try {
        await this.doVerify(v.tenantId, v);
        checked++;
      } catch (err) {
        this.logger.warn(
          `RO ellenőrzés sikertelen (${v.id}): ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`RO megfelelőség-ellenőrzés kész: ${checked} jármű.`);
    return { checked };
  }

  /** A tényleges ellenőrzés + tárolás + emlékeztető-frissítés. */
  private async doVerify(
    tenantId: string,
    vehicle: { id: string; plate: string | null; vin: string | null },
  ): Promise<VerificationView> {
    const data = await this.provider.verify({
      plate: vehicle.plate,
      vin: vehicle.vin,
      country: 'RO',
    });

    const toDate = (s: string | null) => (s ? new Date(s) : null);
    const itp = toDate(data.itpValidUntil);
    const rca = toDate(data.rcaValidUntil);
    const vig = toDate(data.vignetteValidUntil);

    await this.prisma.system.vehicleVerification.upsert({
      where: { vehicleId: vehicle.id },
      create: {
        tenantId,
        vehicleId: vehicle.id,
        source: data.source,
        status: data.status,
        itpValidUntil: itp,
        rcaValidUntil: rca,
        vignetteValidUntil: vig,
      },
      update: {
        source: data.source,
        status: data.status,
        itpValidUntil: itp,
        rcaValidUntil: rca,
        vignetteValidUntil: vig,
        checkedAt: new Date(),
      },
    });

    // Csak akkor frissítünk emlékeztetőt, ha valódi adatot kaptunk.
    if (data.status === 'ok') {
      for (const { field, type } of FIELD_TO_TYPE) {
        await this.applyReminder(tenantId, vehicle.id, type, data[field]);
      }
    }

    return {
      source: data.source,
      status: data.status,
      itpValidUntil: data.itpValidUntil,
      rcaValidUntil: data.rcaValidUntil,
      vignetteValidUntil: data.vignetteValidUntil,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Egy verification-eredetű compliance emlékeztető upsertje. A felhasználó által
   * kézzel felvett emlékeztetőket NEM érinti (csak a source="verification"-t).
   */
  private async applyReminder(
    tenantId: string,
    vehicleId: string,
    type: ReminderType,
    dateStr: string | null,
  ): Promise<void> {
    if (!dateStr) return;
    const dueDate = new Date(dateStr);

    const existing = await this.prisma.system.reminder.findFirst({
      where: { tenantId, vehicleId, type, source: 'verification' },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.system.reminder.updateMany({
        where: { id: existing.id, tenantId },
        data: {
          dueDate,
          active: true,
          notifiedStage: null,
          lastNotifiedAt: null,
        },
      });
    } else {
      await this.prisma.system.reminder.create({
        data: {
          tenantId,
          vehicleId,
          kind: ReminderKind.COMPLIANCE,
          type,
          source: 'verification',
          dueDate,
          intervalDays: 365,
        },
      });
    }
  }
}

/** RO rendszám felismerése (normalizálva: csak betű/szám, nagybetű). */
function isRoPlate(plate: string | null): boolean {
  if (!plate) return false;
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Bukarest: B + 2-3 számjegy + 3 betű; megye: 2 betű + 2 számjegy + 3 betű.
  return /^B\d{2,3}[A-Z]{3}$/.test(p) || /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(p);
}
