import { randomUUID } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import { TenantRole, DocumentStatus } from '@valloreg/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService, TenantContext } from '../../src/prisma/tenant-context.service';
import { SpreadsheetParserService } from '../../src/documents/spreadsheet/spreadsheet-parser.service';
import { SpreadsheetImportService } from '../../src/documents/spreadsheet/spreadsheet-import.service';
import { MatchingService } from '../../src/matching/matching.service';
import { InvoicePersistenceService } from '../../src/matching/invoice-persistence.service';
import { makePrisma, seedTenant, cleanup, SeededTenant } from './helpers';

/**
 * Integráció: Excel köteges import COMMIT. Élő Postgres + generált Prisma kliens
 * kell hozzá (a CI futtatja). A storage/extraction/config/audit mockolt; a parser,
 * matching és perzisztálás VALÓS – így a teljes commit-út (Document + Invoice +
 * tételek) ténylegesen a DB-be ír. Ez fogja meg a „dokumentum tartalom nélkül"
 * regressziót (a Document id és az Invoice documentId egyezését).
 */
describe('SpreadsheetImportService.commit (integráció, élő Postgres)', () => {
  let prisma: PrismaService;
  let ctx: TenantContextService;
  let tenant: SeededTenant;
  let tctx: TenantContext;
  let service: SpreadsheetImportService;

  beforeAll(async () => {
    ({ prisma, ctx } = makePrisma());
    await prisma.onModuleInit();

    const parser = new SpreadsheetParserService();
    const matching = new MatchingService(prisma);
    const invoicePersistence = new InvoicePersistenceService(prisma, matching);
    const storage = {
      buildDocumentKey: () => `import/${randomUUID()}.xlsx`,
      upload: async () => undefined,
    };
    const config = { extractionProvider: 'stub' };
    const audit = { log: async () => undefined };
    const extraction = { extract: async () => ({ items: [] }) };

    service = new SpreadsheetImportService(
      prisma,
      config as never,
      storage as never,
      audit as never,
      parser,
      matching,
      invoicePersistence,
      extraction as never,
    );

    tenant = await seedTenant(prisma, TenantRole.OWNER);
    tctx = { tenantId: tenant.tenantId, userId: tenant.userId, role: tenant.role };

    // Jármű a fül nevével egyező rendszámmal (a sor-szintű jármű-illesztéshez).
    await prisma.system.vehicle.create({
      data: { tenantId: tenant.tenantId, plate: 'B104VLR' },
    });
  });

  afterAll(async () => {
    await cleanup(prisma, {
      tenantIds: [tenant?.tenantId].filter(Boolean) as string[],
      userIds: [tenant?.userId].filter(Boolean) as string[],
    });
    await prisma.onModuleDestroy();
  });

  async function buildXlsx(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('B104VLR');
    ws.addRow(['Data', 'Factura', 'Piese', 'Firma', 9788.5, 'KM', 'Fizetve']);
    ws.addRow([
      new Date('2026-01-10'),
      'RO6026000289',
      '0600969Separator de ulei B 1\n470 018 00 80Etansare corp filtru ulei BUC 1',
      'S.C. INTER CARS ROMANIA S.R.L.',
      2008.59,
      516678,
      'IGEN',
    ]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it('commit: a sorból Document + Invoice + tételek jön létre (tartalommal)', async () => {
    const buffer = await buildXlsx();
    const file = {
      originalname: '2026_KIADASOK.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
      buffer,
    };

    const result = await ctx.runWith(tctx, () =>
      service.commit(tenant.tenantId, tenant.userId, file),
    );

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);

    // A létrejött dokumentum a számlájával és tételeivel (a tartalom!).
    const docs = await prisma.system.document.findMany({
      where: { tenantId: tenant.tenantId },
      include: { invoice: { include: { items: true } } },
    });
    expect(docs).toHaveLength(1);
    const doc = docs[0]!;
    // Magas confidence nélkül (figyelmeztetésekkel) NEEDS_REVIEW; de lehet AUTO_OK is.
    expect([DocumentStatus.AUTO_OK, DocumentStatus.NEEDS_REVIEW]).toContain(doc.status);

    // A LÉNYEG: van számla a dokumentumhoz, tételekkel.
    expect(doc.invoice).not.toBeNull();
    expect(doc.invoice!.documentId).toBe(doc.id);
    expect(Number(doc.invoice!.grossTotal)).toBeCloseTo(2008.59);
    expect(doc.invoice!.items.length).toBeGreaterThanOrEqual(2);
    // A jármű-illesztés a fül nevéből: a tételek a járműhöz kötve.
    expect(doc.invoice!.items.every((i) => i.vehicleId)).toBe(true);
  });

  it('újra-commit ugyanazzal a fájllal: idempotens (skip, nincs duplikátum)', async () => {
    const buffer = await buildXlsx();
    const file = {
      originalname: '2026_KIADASOK.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
      buffer,
    };
    const result = await ctx.runWith(tctx, () =>
      service.commit(tenant.tenantId, tenant.userId, file),
    );
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    const count = await prisma.system.document.count({
      where: { tenantId: tenant.tenantId },
    });
    expect(count).toBe(1); // nem duplikálódott
  });

  it('tartalmi duplikátum: már LÉTEZŐ számla (beolvasott) + azonos beszállító/számlaszám → DUPLICATE', async () => {
    // Egy "beolvasott" számla seedelése a system kliensen (más fájl, más sha) –
    // mintha korábban feltöltötték volna. Beszállító + számlaszám: ACME / INV-999.
    const supplier = await prisma.system.supplier.create({
      data: { tenantId: tenant.tenantId, name: 'ACME SRL', normalizedName: 'acme srl' },
    });
    const scanDoc = await prisma.system.document.create({
      data: {
        tenantId: tenant.tenantId,
        uploadedById: tenant.userId,
        fileName: 'beolvasott.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storageKey: `k/${randomUUID()}`,
        sha256: randomUUID().replace(/-/g, ''),
        status: DocumentStatus.CONFIRMED,
      },
    });
    await prisma.system.invoice.create({
      data: {
        tenantId: tenant.tenantId,
        documentId: scanDoc.id,
        supplierId: supplier.id,
        invoiceNumber: 'INV-999',
        confidence: 1,
      },
    });

    // Excel ugyanazzal a beszállítóval + számlaszámmal (de a fájl SOHA nem volt
    // importálva → a sha-egyezés NEM játszik, csak a tartalmi egyezés).
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('B104VLR');
    ws.addRow(['Data', 'Factura', 'Piese', 'Firma', 'Suma', 'KM', 'Fizetve']);
    ws.addRow([
      new Date('2026-02-02'),
      'INV-999',
      'Valami alkatresz 1',
      'ACME SRL',
      500,
      600000,
      'IGEN',
    ]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const file = {
      originalname: 'masik.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
      buffer,
    };

    const preview = await ctx.runWith(tctx, () => service.preview(file));
    const row = preview.rows.find((r) => r.invoiceNumber === 'INV-999');
    expect(row).toBeDefined();
    expect(row!.action).toBe('duplicate');
    expect(preview.summary.create).toBe(0);
    expect(preview.summary.duplicate).toBeGreaterThanOrEqual(1);
  });
});
