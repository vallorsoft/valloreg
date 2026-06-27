import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  DocumentStatus,
  effectiveStorageBytes,
  isAllowedDocumentMimeType,
  isWithinLimit,
  PLAN_LIMITS,
  PlanTier,
  UNLIMITED,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsQueueService } from '../queue/documents-queue.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';

/** A confidence küszöb, ami felett a számla AUTO_OK (egyébként NEEDS_REVIEW). */
const AUTO_OK_CONFIDENCE_THRESHOLD = 0.8;

/** A feltöltött fájl (multer memory storage). */
export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Dokumentum műveletek. A Document modell tenant-scope-olt; a worker enqueue-hoz
 * a tenantId-t expliciten átadjuk (a worker nem request-kontextusban fut).
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
    private readonly queue: DocumentsQueueService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Dokumentum feltöltése EGY lépésben (szerveroldali proxy):
   *  - a böngésző a fájlt multipart-ként az API-nak küldi,
   *  - MIME + méret validáció, sha256 a szerveren (idempotencia),
   *  - feltöltés az objektumtárba (nincs böngésző→S3 CORS / presigned URL),
   *  - Document(QUEUED) létrehozás + feldolgozás sorbavétele.
   */
  async upload(
    tenantId: string,
    userId: string,
    file: UploadedDocumentFile | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw AppException.validation('Hiányzik a feltöltendő fájl.');
    }
    const mimeType = file.mimetype || 'application/octet-stream';
    if (!isAllowedDocumentMimeType(mimeType)) {
      throw AppException.unsupportedDocumentType();
    }
    if (file.size > this.config.maxDocumentSizeBytes) {
      throw AppException.documentTooLarge();
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    // Idempotencia: ugyanaz a fájl (sha256) már létezik? Ha igen, és még nem
    // dolgoztuk fel, biztosítjuk a sorbavételt (egy korábbi Redis-hiba után is).
    const existing = await this.prisma.scoped.document.findFirst({
      where: { sha256 },
    });
    if (existing) {
      if (
        existing.status === DocumentStatus.UPLOADED ||
        existing.status === DocumentStatus.QUEUED ||
        existing.status === DocumentStatus.FAILED
      ) {
        await this.safeEnqueue(tenantId, existing.id, sha256);
      }
      return existing;
    }

    await this.assertMonthlyDocumentLimit(tenantId);
    await this.assertStorageLimit(tenantId, file.size);

    const documentId = randomUUID();
    const storageKey = this.storage.buildDocumentKey(
      tenantId,
      documentId,
      file.originalname,
    );

    // Előbb a tárhelyre töltünk; ha ez hibázik, nem jön létre árva DB-rekord.
    await this.storage.upload(storageKey, file.buffer, mimeType);

    const document = await this.prisma.scoped.document.create({
      // tenantId-t a scoped kliens is injektálja; explicit a típusbiztonságért.
      data: {
        tenantId,
        uploadedById: userId,
        fileName: file.originalname,
        mimeType,
        sizeBytes: file.size,
        storageKey,
        sha256,
        status: DocumentStatus.QUEUED,
      },
    });

    // A sorbavétel hibája NE bukassa el a feltöltést: a fájl már tárolva van,
    // a dokumentum létrejött. (Redis-kimaradás esetén egy újbóli feltöltés a
    // fenti idempotencia-ág újra sorba teszi.)
    await this.safeEnqueue(tenantId, document.id, sha256);

    await this.audit.log({
      tenantId,
      userId,
      action: 'document.uploaded',
      resourceType: 'Document',
      resourceId: document.id,
      metadata: { fileName: file.originalname, sizeBytes: file.size },
    });

    return document;
  }

  /** Sorbavétel hibatűrően: a hibát naplózzuk, de nem dobjuk tovább. */
  private async safeEnqueue(
    tenantId: string,
    documentId: string,
    sha256: string,
  ): Promise<void> {
    try {
      await this.queue.enqueueProcess({ tenantId, documentId, sha256 });
    } catch (err) {
      this.logger.error(
        `Dokumentum sorbavétele sikertelen (id=${documentId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Dokumentum jóváhagyása (AUTO_OK | NEEDS_REVIEW → CONFIRMED).
   * Idempotens: már CONFIRMED dokumentum újra-jóváhagyása no-op.
   */
  async confirm(tenantId: string, userId: string, id: string) {
    const document = await this.prisma.scoped.document.findFirst({ where: { id } });
    if (!document) throw AppException.notFound('A dokumentum nem található.');

    if (document.status === DocumentStatus.CONFIRMED) {
      return document;
    }

    const confirmable = [DocumentStatus.AUTO_OK, DocumentStatus.NEEDS_REVIEW];
    if (!confirmable.includes(document.status as (typeof confirmable)[number])) {
      throw AppException.validation(
        `A dokumentum ${document.status} állapotban nem hagyható jóvá.`,
      );
    }

    await this.prisma.scoped.document.update({
      where: { id },
      data: { status: DocumentStatus.CONFIRMED },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'document.confirmed',
      resourceType: 'Document',
      resourceId: id,
      metadata: { previousStatus: document.status },
    });

    return { ...document, status: DocumentStatus.CONFIRMED };
  }

  /**
   * Lehetséges duplikátum feloldása FELÜLÍRÁSSAL. A duplikátum nem tartható meg
   * párhuzamosan: az egyetlen továbblépés, hogy az ÚJ (duplikátumként jelölt)
   * dokumentum FELÜLÍRJA az eredetit – az eredeti dokumentum (és számlája,
   * tételei, fájlja) törlődik, az új pedig a megszokott állapotba (AUTO_OK /
   * NEEDS_REVIEW) kerül a saját confidence-e alapján.
   *
   * A felhasználó a duplikátumot el is dobhatja a sima törléssel (`remove`);
   * "megtartás" (két párhuzamos rekord) szándékosan NEM lehetséges.
   */
  async overwriteDuplicate(tenantId: string, userId: string, id: string) {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id },
      include: { invoice: { select: { confidence: true } } },
    });
    if (!document) throw AppException.notFound('A dokumentum nem található.');

    if (document.status !== DocumentStatus.DUPLICATE || !document.duplicateOfId) {
      throw AppException.validation(
        'Ez a dokumentum nincs duplikátumként megjelölve.',
      );
    }

    // Az eredeti (felülírandó) dokumentum törlése – cascade viszi a számlát és a
    // tételeket; a tárolt fájlt best-effort takarítjuk.
    const original = await this.prisma.scoped.document.findFirst({
      where: { id: document.duplicateOfId },
      select: { id: true, fileName: true, storageKey: true },
    });
    if (original) {
      await this.prisma.scoped.document.delete({ where: { id: original.id } });
      try {
        await this.storage.delete(original.storageKey);
      } catch (err) {
        this.logger.warn(
          `Az eredeti fájl törlése sikertelen (${original.storageKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // Az új dokumentum előléptetése: duplikátum-jelölés feloldása + végleges
    // státusz a saját számla-confidence alapján.
    const confidence = document.invoice?.confidence ?? 0;
    const nextStatus =
      confidence >= AUTO_OK_CONFIDENCE_THRESHOLD
        ? DocumentStatus.AUTO_OK
        : DocumentStatus.NEEDS_REVIEW;

    await this.prisma.scoped.document.update({
      where: { id },
      data: { status: nextStatus, duplicateOfId: null },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'document.duplicate_overwritten',
      resourceType: 'Document',
      resourceId: id,
      metadata: {
        overwrittenDocumentId: original?.id ?? null,
        overwrittenFileName: original?.fileName ?? null,
        newStatus: nextStatus,
      },
    });

    return { ...document, status: nextStatus, duplicateOfId: null };
  }

  /**
   * Dokumentum teljes törlése: a Document rekorddal a séma cascade-je törli a
   * hozzá tartozó Invoice-t és minden InvoiceItem-et is (így a riport/stat/
   * insight/TCO – amelyek ezekből számolnak – automatikusan frissül). A tárolt
   * fájlt is töröljük az objektumtárból (best-effort, hogy ne maradjon árva fájl).
   *
   * Megjegyzés: a tanuló mappingek (SupplierVehicleMapping/ItemCategoryMapping)
   * több dokumentum hozzájárulásából képzett aggregált súlyok – ezeket
   * szándékosan NEM bontjuk vissza (nem dokumentumonként követjük, és más számlák
   * tanulását is rontaná).
   */
  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id },
      select: { id: true, fileName: true, storageKey: true },
    });
    if (!document) throw AppException.notFound('A dokumentum nem található.');

    // DB törlés (cascade: Invoice + InvoiceItem) – ez a felhasználó számára a
    // mérvadó művelet, ezért előbb ezt végezzük el.
    await this.prisma.scoped.document.delete({ where: { id } });

    // A tárolt fájl törlése best-effort: ha az objektumtár épp hibázik, az adat
    // már eltűnt a rendszerből; az árva fájl később takarítható.
    try {
      await this.storage.delete(document.storageKey);
    } catch (err) {
      this.logger.warn(
        `A fájl törlése a tárból sikertelen (${document.storageKey}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'document.deleted',
      resourceType: 'Document',
      resourceId: id,
      metadata: { fileName: document.fileName },
    });
  }

  list() {
    return this.prisma.scoped.document.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id },
      include: {
        invoice: { include: { items: true, supplier: true } },
      },
    });
    if (!document) {
      throw AppException.notFound('A dokumentum nem található.');
    }

    // Duplikátum esetén megmutatjuk, MIT írna felül: az eredeti dokumentum
    // számla-összegzését (a felhasználó csak felülírhatja, megtartani nem tudja).
    let duplicateOf: Awaited<ReturnType<typeof this.loadDuplicateOriginal>> = null;
    if (document.duplicateOfId) {
      duplicateOf = await this.loadDuplicateOriginal(document.duplicateOfId);
    }

    return { ...document, duplicateOf };
  }

  /** Az eredeti (felülírható) dokumentum összegzése a duplikátum-nézethez. */
  private async loadDuplicateOriginal(originalId: string) {
    const original = await this.prisma.scoped.document.findFirst({
      where: { id: originalId },
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        invoice: {
          include: { items: true, supplier: true },
        },
      },
    });
    return original;
  }

  /** Presigned GET URL a dokumentum letöltéséhez. */
  async getDownloadUrl(id: string): Promise<{ downloadUrl: string }> {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id },
      select: { storageKey: true },
    });
    if (!document) {
      throw AppException.notFound('A dokumentum nem található.');
    }
    // Kézi rögzítésű (számla nélküli) rekordhoz nincs tárolt fájl.
    if (!document.storageKey) {
      throw AppException.validation('Ehhez a kézi rekordhoz nincs letölthető fájl.');
    }
    const downloadUrl = await this.storage.presignGet(document.storageKey);
    return { downloadUrl };
  }

  /** Havi (naptári hónap) feldolgozott dokumentum-limit ellenőrzése. */
  private async assertMonthlyDocumentLimit(tenantId: string): Promise<void> {
    const subscription = await this.prisma.system.subscription.findUnique({
      where: { tenantId },
      select: { planTier: true },
    });
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limit = PLAN_LIMITS[planTier].maxDocumentsPerMonth;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const count = await this.prisma.scoped.document.count({
      where: { createdAt: { gte: monthStart } },
    });

    if (!isWithinLimit(count, limit)) {
      throw AppException.documentsLimitReached();
    }
  }

  /**
   * Tárhely-keret ellenőrzése feltöltés előtt. Az effektív keret = csomag-
   * tárhely + vásárolt extra (Tenant.extraStorageGb). A használat a tárolt
   * dokumentumok és jármű-dokumentumok méretének összege (tenant-scope).
   */
  private async assertStorageLimit(
    tenantId: string,
    additionalBytes: number,
  ): Promise<void> {
    const [subscription, tenant] = await Promise.all([
      this.prisma.system.subscription.findUnique({
        where: { tenantId },
        select: { planTier: true },
      }),
      this.prisma.system.tenant.findUnique({
        where: { id: tenantId },
        select: { extraStorageGb: true },
      }),
    ]);
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const effective = effectiveStorageBytes(
      PLAN_LIMITS[planTier].maxStorageBytes,
      tenant?.extraStorageGb ?? 0,
    );
    if (effective === UNLIMITED) return;

    const [docSize, vehicleDocSize] = await Promise.all([
      this.prisma.scoped.document.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.scoped.vehicleDocument.aggregate({ _sum: { sizeBytes: true } }),
    ]);
    const used =
      (docSize._sum.sizeBytes ?? 0) + (vehicleDocSize._sum.sizeBytes ?? 0);

    if (used + additionalBytes > effective) {
      throw AppException.storageLimitReached();
    }
  }
}
