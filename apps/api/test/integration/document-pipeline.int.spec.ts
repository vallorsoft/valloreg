import { randomUUID } from 'node:crypto';
import { DocumentStatus, DocumentType, TenantRole } from '@valloreg/shared';
import type { ExtractionResult } from '@valloreg/shared';
import { DocumentsProcessor } from '../../src/queue/documents.processor';
import { MatchingService } from '../../src/matching/matching.service';
import { InvoicePersistenceService } from '../../src/matching/invoice-persistence.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { cleanup, makePrisma, seedTenant } from './helpers';

/**
 * Integrációs teszt a dokumentum-feldolgozó pipeline-hoz, ÉLŐ Postgreshez.
 *
 * FONTOS: ez a teszt csak CI-ben fut (generált @prisma/client + migrált DB kell).
 *
 * A `DocumentsProcessor` a worker-szerű `prisma.system` (nem scope-olt) klienst
 * használja, ezért MINDEN seed és lekérdezés EXPLICIT tenantId-vel megy – nincs
 * tenant AsyncLocalStorage kontextus.
 *
 * A privát `process(job)`-ot KÖZVETLENÜL hívjuk (`(processor as any).process`),
 * az `onModuleInit`-et SOSEM (az élő Redis Workert indítana). A `job.data` alakja
 * `{ tenantId, documentId }`.
 *
 * Az OCR és az Extraction provider MOCK – így a teszt a confidence-et és a
 * documentType-ot teljesen kontrollálja; a Matching VALÓS (`MatchingService`).
 * Az `items: []` szándékos: így nincs InvoiceItem-bonyodalom a perzisztálásban.
 */

/** A `process(job)` közvetlen hívása a privát metódusra. */
type RunnableProcessor = {
  process: (job: { data: { tenantId: string; documentId: string } }) => Promise<void>;
};

/** Minimális, de a process + persistInvoice futásához ELÉG ExtractionResult. */
function makeExtraction(opts: {
  documentType: DocumentType;
  confidence: number;
}): ExtractionResult {
  return {
    documentType: opts.documentType,
    invoice: {
      supplier: 'Teszt Szerviz Kft',
      invoiceNumber: `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
      date: '2026-06-01',
      currency: 'HUF',
      odometerKm: null,
      netTotal: 1000,
      taxTotal: 270,
      grossTotal: 1270,
      confidence: opts.confidence,
      vehicleCandidates: [],
    },
    items: [],
  } as unknown as ExtractionResult;
}

describe('DocumentsProcessor pipeline (integráció, élő Postgres)', () => {
  let prisma: PrismaService;

  // A teszt-esetenként frissen gyártott mockok (a hívás-számlálók tiszták).
  let auditMock: { log: jest.Mock };
  let notificationsMock: { sendToUser: jest.Mock };
  let ocrMock: { recognize: jest.Mock };
  let extractionMock: { extract: jest.Mock };
  let processor: RunnableProcessor;

  // Takarításhoz gyűjtjük a seedelt id-ket.
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const made = makePrisma();
    prisma = made.prisma;
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await cleanup(prisma, { tenantIds, userIds });
    await prisma.onModuleDestroy();
  });

  /**
   * Friss mockok + processor minden teszt előtt, hogy a hívás-számlálók
   * (`toHaveBeenCalled` / `not.toHaveBeenCalled`) tiszták legyenek.
   * Az `extract` alapból AUTO_OK-számlát ad; az esetek felülírják.
   */
  beforeEach(() => {
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    notificationsMock = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    ocrMock = {
      recognize: jest.fn().mockResolvedValue({ text: 'minta OCR szöveg', pages: 1 }),
    };
    extractionMock = {
      extract: jest
        .fn()
        .mockResolvedValue(
          makeExtraction({ documentType: DocumentType.INVOICE, confidence: 0.9 }),
        ),
    };

    // Konstruktor-sorrend: (config, prisma, audit, ocr, extraction, matching,
    // invoicePersistence, notifications).
    const matching = new MatchingService(prisma);
    const invoicePersistence = new InvoicePersistenceService(prisma, matching);
    processor = new DocumentsProcessor(
      {} as never,
      prisma,
      auditMock as never,
      ocrMock as never,
      extractionMock as never,
      matching,
      invoicePersistence,
      notificationsMock as never,
    ) as unknown as RunnableProcessor;
  });

  /** Seedel egy izolált tenantot + usert és nyilvántartja a takarításhoz. */
  async function freshTenant(): Promise<{ tenantId: string; userId: string }> {
    const seeded = await seedTenant(prisma, TenantRole.OWNER);
    tenantIds.push(seeded.tenantId);
    userIds.push(seeded.userId);
    return { tenantId: seeded.tenantId, userId: seeded.userId };
  }

  /** Seedel egy friss Document rekordot a megadott (alapból UPLOADED) státusszal. */
  async function seedDocument(
    tenantId: string,
    userId: string,
    status: DocumentStatus = DocumentStatus.UPLOADED,
  ): Promise<string> {
    const doc = await prisma.system.document.create({
      data: {
        tenantId,
        uploadedById: userId,
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storageKey: `k/${randomUUID()}`,
        sha256: randomUUID().replace(/-/g, ''),
        status: status as never,
      },
      select: { id: true },
    });
    return doc.id;
  }

  it('magas confidence (0.9) + INVOICE → Document AUTO_OK és létrejön az Invoice 0.9 confidence-szel', async () => {
    const { tenantId, userId } = await freshTenant();
    const documentId = await seedDocument(tenantId, userId);

    extractionMock.extract.mockResolvedValue(
      makeExtraction({ documentType: DocumentType.INVOICE, confidence: 0.9 }),
    );

    await processor.process({ data: { tenantId, documentId } });

    const doc = await prisma.system.document.findUnique({
      where: { id: documentId },
      select: { status: true },
    });
    expect(doc?.status).toBe(DocumentStatus.AUTO_OK);

    const invoice = await prisma.system.invoice.findUnique({
      where: { documentId },
      select: { confidence: true },
    });
    expect(invoice).not.toBeNull();
    expect(invoice?.confidence).toBe(0.9);
  });

  it('alacsony confidence (0.5) + INVOICE → Document NEEDS_REVIEW', async () => {
    const { tenantId, userId } = await freshTenant();
    const documentId = await seedDocument(tenantId, userId);

    extractionMock.extract.mockResolvedValue(
      makeExtraction({ documentType: DocumentType.INVOICE, confidence: 0.5 }),
    );

    await processor.process({ data: { tenantId, documentId } });

    const doc = await prisma.system.document.findUnique({
      where: { id: documentId },
      select: { status: true },
    });
    expect(doc?.status).toBe(DocumentStatus.NEEDS_REVIEW);
  });

  it('nem-számla documentType (OTHER) → Document NOT_INVOICE és NINCS Invoice', async () => {
    const { tenantId, userId } = await freshTenant();
    const documentId = await seedDocument(tenantId, userId);

    extractionMock.extract.mockResolvedValue(
      makeExtraction({ documentType: DocumentType.OTHER, confidence: 0.9 }),
    );

    await processor.process({ data: { tenantId, documentId } });

    // Az extraction lefutott, de számla NEM készült.
    expect(extractionMock.extract).toHaveBeenCalled();

    const doc = await prisma.system.document.findUnique({
      where: { id: documentId },
      select: { status: true },
    });
    expect(doc?.status).toBe(DocumentStatus.NOT_INVOICE);

    const invoice = await prisma.system.invoice.findUnique({
      where: { documentId },
      select: { id: true },
    });
    expect(invoice).toBeNull();
  });

  it('idempotencia: már terminál státuszú (AUTO_OK) Document → no-op, a státusz változatlan és az extraction NEM hívódik', async () => {
    const { tenantId, userId } = await freshTenant();
    // A Document MÁR terminál státusszal (AUTO_OK) seedelve.
    const documentId = await seedDocument(tenantId, userId, DocumentStatus.AUTO_OK);

    await processor.process({ data: { tenantId, documentId } });

    // A process az ELEJÉN kilép → az extraction (és az OCR) sosem fut.
    expect(extractionMock.extract).not.toHaveBeenCalled();

    const doc = await prisma.system.document.findUnique({
      where: { id: documentId },
      select: { status: true },
    });
    expect(doc?.status).toBe(DocumentStatus.AUTO_OK);
  });
});
