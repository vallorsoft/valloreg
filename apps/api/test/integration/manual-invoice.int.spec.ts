import { randomUUID } from 'node:crypto';
import { TenantRole, MANUAL_DOCUMENT_MIME_TYPE, DocumentStatus } from '@valloreg/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService, TenantContext } from '../../src/prisma/tenant-context.service';
import { InvoicesService } from '../../src/invoices/invoices.service';
import { makePrisma, seedTenant, cleanup, SeededTenant } from './helpers';

/**
 * Integráció: KÉZI javítás-rögzítés (számla nélkül). Élő Postgres + generált
 * Prisma kliens kell hozzá (a CI futtatja). Ellenőrzi, hogy a manuális rekord
 * Document(CONFIRMED, fájl nélkül) + Invoice + tételek (alkatrész + munkadíj)
 * helyesen jön létre, járműhöz kötve, a végösszeg a tételekből számolva.
 */
describe('InvoicesService.createManual (integráció, élő Postgres)', () => {
  let prisma: PrismaService;
  let ctx: TenantContextService;
  let tenant: SeededTenant;
  let tctx: TenantContext;
  let vehicleId: string;

  const audit = { log: async () => undefined };
  let service: InvoicesService;

  beforeAll(async () => {
    ({ prisma, ctx } = makePrisma());
    await prisma.onModuleInit();
    service = new InvoicesService(prisma, audit as never);

    tenant = await seedTenant(prisma, TenantRole.OWNER);
    tctx = { tenantId: tenant.tenantId, userId: tenant.userId, role: tenant.role };

    const v = await prisma.system.vehicle.create({
      data: { tenantId: tenant.tenantId, plate: `IT-${randomUUID()}` },
    });
    vehicleId = v.id;
  });

  afterAll(async () => {
    await cleanup(prisma, {
      tenantIds: [tenant?.tenantId].filter(Boolean) as string[],
      userIds: [tenant?.userId].filter(Boolean) as string[],
    });
    await prisma.onModuleDestroy();
  });

  it('alkatrész + munkadíj külön tételként → manuális Document + Invoice', async () => {
    const result = await ctx.runWith(tctx, () =>
      service.createManual(tenant.tenantId, tenant.userId, {
        vehicleId,
        date: '2026-05-01',
        supplier: 'Saját műhely',
        items: [
          {
            name: 'Fékbetét',
            category: 'part',
            type: 'vehicle',
            articleNumber: 'K123',
            quantity: 2,
            unitPrice: 100,
          },
          { name: 'Csere munkadíj', category: 'labor', type: 'vehicle', price: 150 },
        ],
      }),
    );

    expect(result.documentId).toBeTruthy();
    expect(result.invoiceId).toBeTruthy();

    // Document: manuális MIME, fájl nélkül, CONFIRMED.
    const doc = await prisma.system.document.findUnique({
      where: { id: result.documentId },
      select: { status: true, mimeType: true, storageKey: true },
    });
    expect(doc?.status).toBe(DocumentStatus.CONFIRMED);
    expect(doc?.mimeType).toBe(MANUAL_DOCUMENT_MIME_TYPE);
    expect(doc?.storageKey).toBe('');

    // Invoice: végösszeg = 2*100 + 150 = 350; járműhöz kötött tételek.
    const invoice = await prisma.system.invoice.findUnique({
      where: { id: result.invoiceId },
      select: {
        grossTotal: true,
        items: {
          select: { name: true, category: true, price: true, vehicleId: true, partKey: true },
        },
      },
    });
    expect(Number(invoice?.grossTotal)).toBeCloseTo(350);
    expect(invoice?.items).toHaveLength(2);

    const part = invoice?.items.find((i) => i.category === 'part');
    const labor = invoice?.items.find((i) => i.category === 'labor');
    expect(Number(part?.price)).toBeCloseTo(200);
    expect(part?.vehicleId).toBe(vehicleId);
    expect(part?.partKey).toBeTruthy(); // cikkszámból képzett kulcs
    expect(Number(labor?.price)).toBeCloseTo(150);
    expect(labor?.vehicleId).toBe(vehicleId);
  });
});
