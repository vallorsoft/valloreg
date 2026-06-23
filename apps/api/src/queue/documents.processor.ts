import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType, ItemType } from '@valloreg/shared';
import type { ExtractionResult } from '@valloreg/shared';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OCR_PROVIDER } from '../ocr/ocr.provider';
import type { OcrProvider } from '../ocr/ocr.provider';
import { EXTRACTION_PROVIDER } from '../extraction/extraction.provider';
import type { ExtractionProvider } from '../extraction/extraction.provider';
import { MatchingService } from '../matching/matching.service';
import type { VehicleMatch } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DOCUMENTS_QUEUE,
  ProcessDocumentJobData,
} from './queue.constants';

/** A confidence küszöb, ami felett a számla AUTO_OK (egyébként NEEDS_REVIEW). */
const AUTO_OK_CONFIDENCE_THRESHOLD = 0.8;

/**
 * A `documents` queue worker-e.
 *
 * Fontos: a worker NEM request-kontextusban fut, ezért NINCS AsyncLocalStorage
 * tenant kontextus. Ezért a SYSTEM Prisma klienst használja, és a tenantId-t
 * MINDEN where/data-ban EXPLICITEN megadja.
 *
 * Folyamat:
 *   loadDocument → OCR_RUNNING → OCR → EXTRACTING → extraction
 *   → Invoice + InvoiceItem perzisztálás → AUTO_OK | NEEDS_REVIEW → audit.
 *
 * Idempotencia: ha a dokumentum státusza már terminál (CONFIRMED/AUTO_OK/
 * NEEDS_REVIEW/ARCHIVED), a job no-op. A jobId is sha256-alapú (lásd producer).
 *
 * Retry/DLQ: a Queue defaultJobOptions ad 3 próbálkozást exponenciális
 * backoff-fal; tartós hiba esetén a job a 'failed' halmazban marad (DLQ-szerű).
 */
@Injectable()
export class DocumentsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentsProcessor.name);
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(EXTRACTION_PROVIDER)
    private readonly extraction: ExtractionProvider,
    private readonly matching: MatchingService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    const redis = this.config.redis;
    this.worker = new Worker<ProcessDocumentJobData>(
      DOCUMENTS_QUEUE,
      (job) => this.process(job),
      {
        connection: redis,
        concurrency: 2,
      },
    );

    // Kezeletlen 'error' esemény (pl. Redis-kapcsolat hiba) nélkül a Node
    // leállhat ('Unhandled error event') – ezért külön, nem-fatális listener.
    this.worker.on('error', (err) => {
      this.logger.warn(`Documents worker hiba: ${err.message}`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Job sikertelen (${job?.id}): ${err.message}`,
        err.stack,
      );
    });

    this.logger.log('Documents worker elindult.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<ProcessDocumentJobData>): Promise<void> {
    const { tenantId, documentId } = job.data;

    const document = await this.prisma.system.document.findFirst({
      where: { id: documentId, tenantId },
    });

    if (!document) {
      this.logger.warn(
        `Dokumentum nem található (id: ${documentId}, tenant: ${tenantId}) – kihagyva.`,
      );
      return;
    }

    // Idempotencia: ha már feldolgozott/terminál státusz, ne dolgozzuk fel újra.
    const terminal: string[] = [
      DocumentStatus.AUTO_OK,
      DocumentStatus.NEEDS_REVIEW,
      DocumentStatus.CONFIRMED,
      DocumentStatus.NOT_INVOICE,
      DocumentStatus.DUPLICATE,
      DocumentStatus.ARCHIVED,
    ];
    if (terminal.includes(document.status)) {
      this.logger.log(
        `Dokumentum már feldolgozott (${document.status}) – idempotens kihagyás.`,
      );
      return;
    }

    try {
      // 1) OCR
      await this.setStatus(tenantId, documentId, DocumentStatus.OCR_RUNNING);
      const ocrResult = await this.ocr.recognize({
        storageKey: document.storageKey,
        mimeType: document.mimeType,
        tenantId,
        documentId,
      });

      // 2) Extraction (ez OSZTÁLYOZ is: documentType).
      await this.setStatus(tenantId, documentId, DocumentStatus.EXTRACTING);
      const extraction = await this.extraction.extract(ocrResult.text, {
        tenantId,
        documentId,
      });

      // 2/b) Felismerés: ha NEM számla, nem készítünk belőle számlát – csak
      //      jelezzük a típust (a felhasználó a megfelelő helyre viszi).
      if (extraction.documentType !== DocumentType.INVOICE) {
        await this.markNotInvoice(
          tenantId,
          documentId,
          extraction.documentType,
        );
        await this.audit.log({
          tenantId,
          action: 'document.classified_non_invoice',
          resourceType: 'Document',
          resourceId: documentId,
          metadata: { docType: extraction.documentType, ocrPages: ocrResult.pages },
        });
        await this.notifyClassified(
          document.uploadedById,
          document.fileName,
          documentId,
          extraction.documentType,
        );
        return;
      }

      // 3) Felismerés: beszállító feloldása + jármű-matching (a tanult mappingek
      //    és a rendszám/VIN egyezés alapján).
      const supplierId = await this.matching.resolveSupplierId(
        tenantId,
        extraction.invoice.supplier,
      );
      const vehicleMatch = await this.matching.resolveVehicleForInvoice(
        tenantId,
        extraction,
        supplierId,
      );

      // 4) Perzisztálás (Invoice + InvoiceItem) – idempotens upsert a documentId-re.
      await this.persistInvoice(
        tenantId,
        documentId,
        extraction,
        supplierId,
        vehicleMatch,
      );

      // 5) Tartalmi duplikátum-figyelés: azonos beszállító + számlaszám már
      //    létezik egy MÁSIK (nem-duplikátum) dokumentumon? Ha igen, a státusz
      //    DUPLICATE és a felhasználó felülírhatja az eredetit.
      const duplicateOfId = await this.findDuplicateOriginal(
        tenantId,
        documentId,
        supplierId,
        extraction.invoice.invoiceNumber,
      );

      // 6) Státusz: duplikátum > confidence-alapú.
      const nextStatus = duplicateOfId
        ? DocumentStatus.DUPLICATE
        : extraction.invoice.confidence >= AUTO_OK_CONFIDENCE_THRESHOLD
          ? DocumentStatus.AUTO_OK
          : DocumentStatus.NEEDS_REVIEW;
      await this.finalizeInvoiceDocument(
        tenantId,
        documentId,
        nextStatus,
        duplicateOfId,
      );

      // 7) Audit
      await this.audit.log({
        tenantId,
        action: duplicateOfId ? 'document.duplicate_detected' : 'document.processed',
        resourceType: 'Document',
        resourceId: documentId,
        metadata: {
          status: nextStatus,
          confidence: extraction.invoice.confidence,
          itemCount: extraction.items.length,
          ocrPages: ocrResult.pages,
          supplierId,
          matchedVehicleId: vehicleMatch.vehicleId,
          matchSource: vehicleMatch.source,
          duplicateOfId,
        },
      });

      // 8) Push értesítés a feltöltőnek (ha feliratkozott). A push hibája soha
      //    nem buktathatja meg a feldolgozást, ezért külön try/catch.
      try {
        const duplicate = nextStatus === DocumentStatus.DUPLICATE;
        const needsReview = nextStatus === DocumentStatus.NEEDS_REVIEW;
        await this.notifications.sendToUser(document.uploadedById, {
          title: duplicate
            ? 'Lehetséges duplikátum'
            : needsReview
              ? 'Dokumentum ellenőrzésre vár'
              : 'Dokumentum feldolgozva',
          body: duplicate
            ? `A(z) "${document.fileName}" azonos beszállító + számlaszám alapján már létezik. Felülírható.`
            : needsReview
              ? `A(z) "${document.fileName}" feldolgozása kész, de ellenőrzést igényel.`
              : `A(z) "${document.fileName}" automatikusan feldolgozva.`,
          url: `/documents/${documentId}`,
        });
      } catch (err) {
        this.logger.warn(
          `Push értesítés sikertelen (${documentId}): ${(err as Error).message}`,
        );
      }
    } catch (err) {
      await this.setStatus(tenantId, documentId, DocumentStatus.FAILED);
      await this.audit.log({
        tenantId,
        action: 'document.processing_failed',
        resourceType: 'Document',
        resourceId: documentId,
        metadata: { error: (err as Error).message },
      });
      // Dobjuk tovább, hogy a BullMQ retry/backoff életbe lépjen.
      throw err;
    }
  }

  private async setStatus(
    tenantId: string,
    documentId: string,
    status: DocumentStatus,
  ): Promise<void> {
    await this.prisma.system.document.updateMany({
      where: { id: documentId, tenantId },
      // A shared és a Prisma DocumentStatus string-értékei azonosak; a cast a
      // két nominális típus áthidalása.
      data: { status: status as Prisma.DocumentUpdateManyMutationInput['status'] },
    });
  }

  /** Nem-számla dokumentum: státusz NOT_INVOICE + a felismert típus rögzítése. */
  private async markNotInvoice(
    tenantId: string,
    documentId: string,
    docType: string,
  ): Promise<void> {
    await this.prisma.system.document.updateMany({
      where: { id: documentId, tenantId },
      data: {
        status: DocumentStatus.NOT_INVOICE as Prisma.DocumentUpdateManyMutationInput['status'],
        docType,
      },
    });
  }

  /** Számla-dokumentum lezárása: státusz + docType + (esetleges) duplikátum-hivatkozás. */
  private async finalizeInvoiceDocument(
    tenantId: string,
    documentId: string,
    status: DocumentStatus,
    duplicateOfId: string | null,
  ): Promise<void> {
    await this.prisma.system.document.updateMany({
      where: { id: documentId, tenantId },
      data: {
        status: status as Prisma.DocumentUpdateManyMutationInput['status'],
        docType: DocumentType.INVOICE,
        duplicateOfId,
      },
    });
  }

  /**
   * Tartalmi duplikátum keresése: azonos beszállító + (normalizált) számlaszám,
   * de MÁS dokumentumon, amely maga NEM duplikátum. A legkorábbi találat az
   * "eredeti", amit a felhasználó felülírhat. Üres beszállító/számlaszám → nincs
   * megbízható egyezés (null).
   */
  private async findDuplicateOriginal(
    tenantId: string,
    documentId: string,
    supplierId: string | null,
    invoiceNumber: string,
  ): Promise<string | null> {
    const normalized = normalizeInvoiceNumber(invoiceNumber);
    if (!supplierId || !normalized) return null;

    const candidates = await this.prisma.system.invoice.findMany({
      where: {
        tenantId,
        supplierId,
        documentId: { not: documentId },
      },
      select: {
        invoiceNumber: true,
        documentId: true,
        document: { select: { status: true, createdAt: true } },
      },
      orderBy: { document: { createdAt: 'asc' } },
    });

    for (const c of candidates) {
      // A maga is duplikátumként megjelölt dokumentumot nem tekintjük eredetinek.
      if (c.document?.status === DocumentStatus.DUPLICATE) continue;
      if (normalizeInvoiceNumber(c.invoiceNumber ?? '') === normalized) {
        return c.documentId;
      }
    }
    return null;
  }

  /** Push értesítés a nem-számla osztályozásról (best-effort). */
  private async notifyClassified(
    userId: string,
    fileName: string,
    documentId: string,
    docType: string,
  ): Promise<void> {
    try {
      await this.notifications.sendToUser(userId, {
        title: 'Dokumentum felismerve',
        body: `A(z) "${fileName}" nem szervizszámla (felismert típus: ${docType}). Nem készült belőle számla.`,
        url: `/documents/${documentId}`,
      });
    } catch (err) {
      this.logger.warn(
        `Push értesítés sikertelen (${documentId}): ${(err as Error).message}`,
      );
    }
  }

  private async persistInvoice(
    tenantId: string,
    documentId: string,
    extraction: ExtractionResult,
    supplierId: string | null,
    vehicleMatch: VehicleMatch,
  ): Promise<void> {
    const inv = extraction.invoice;

    await this.prisma.system.$transaction(async (tx) => {
      // Számla upsert a documentId-re (idempotens újrafeldolgozáshoz).
      const invoice = await tx.invoice.upsert({
        where: { documentId },
        create: {
          tenantId,
          documentId,
          supplierId,
          invoiceNumber: inv.invoiceNumber || null,
          date: inv.date ? new Date(inv.date) : null,
          currency: inv.currency || null,
          odometerKm: inv.odometerKm ?? null,
          netTotal: inv.netTotal ?? null,
          taxTotal: inv.taxTotal ?? null,
          grossTotal: inv.grossTotal ?? null,
          confidence: inv.confidence,
          extractionRaw: extraction as unknown as Prisma.InputJsonValue,
        },
        update: {
          supplierId,
          invoiceNumber: inv.invoiceNumber || null,
          date: inv.date ? new Date(inv.date) : null,
          currency: inv.currency || null,
          odometerKm: inv.odometerKm ?? null,
          netTotal: inv.netTotal ?? null,
          taxTotal: inv.taxTotal ?? null,
          grossTotal: inv.grossTotal ?? null,
          confidence: inv.confidence,
          extractionRaw: extraction as unknown as Prisma.InputJsonValue,
        },
      });

      // Korábbi tételek törlése, majd újra létrehozás (egyszerű, idempotens).
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id, tenantId },
      });

      if (extraction.items.length > 0) {
        await tx.invoiceItem.createMany({
          data: extraction.items.map((item) => ({
            tenantId,
            invoiceId: invoice.id,
            name: item.name,
            category: item.category,
            partType: item.partType ?? null,
            type: item.type,
            // Jármű-hozzárendelés prioritása: az extrakció által megadott id, majd
            // a matching motor egyezése – csak a jármű-típusú tételekre.
            vehicleId:
              item.vehicleId ??
              (item.type === ItemType.VEHICLE ? vehicleMatch.vehicleId : null),
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? null,
            price: item.price,
            confidence: item.confidence,
          })),
        });
      }
    });
  }
}

/**
 * Számlaszám normalizálása a duplikátum-összevetéshez: nagybetű, csak betűk és
 * számok (a "SZ-2026/0001" és "sz 2026 0001" ugyanaz). Üres → üres string.
 */
function normalizeInvoiceNumber(value: string): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
