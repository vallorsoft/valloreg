import { randomUUID } from 'node:crypto';
import { TenantRole } from '@valloreg/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import {
  cleanup,
  makePrisma,
  SeededTenant,
  seedTenant,
  TenantContext,
} from './helpers';

/**
 * A legfontosabb invariáns: a `prisma.scoped` kliens tenant-izolációja
 * fail-closed módon, kódszinten érvényesül – nem csak a sémában.
 *
 * Élő Postgres + generált @prisma/client kell hozzá (a CI futtatja).
 */
describe('Prisma tenant-scope kiterjesztés (integráció)', () => {
  let prisma: PrismaService;
  let ctx: TenantContextService;

  let tenantA: SeededTenant;
  let tenantB: SeededTenant;
  let ctxA: TenantContext;
  let ctxB: TenantContext;

  // A két seedelt jármű (mindkettő a system kliensen, explicit tenantId-vel).
  let vehicleAId: string;
  let vehicleBId: string;
  const plateA = `IT-${randomUUID()}`;
  const plateB = `IT-${randomUUID()}`;

  // A teszt során scoped-create-tel létrejövő jármű (cleanup a tenanttel megy).
  const createdPlate = `IT-${randomUUID()}`;

  beforeAll(async () => {
    ({ prisma, ctx } = makePrisma());
    await prisma.onModuleInit();

    tenantA = await seedTenant(prisma, TenantRole.OWNER);
    tenantB = await seedTenant(prisma, TenantRole.OWNER);

    ctxA = { tenantId: tenantA.tenantId, userId: tenantA.userId, role: tenantA.role };
    ctxB = { tenantId: tenantB.tenantId, userId: tenantB.userId, role: tenantB.role };

    const va = await prisma.system.vehicle.create({
      data: { tenantId: tenantA.tenantId, plate: plateA },
    });
    const vb = await prisma.system.vehicle.create({
      data: { tenantId: tenantB.tenantId, plate: plateB },
    });
    vehicleAId = va.id;
    vehicleBId = vb.id;
  });

  afterAll(async () => {
    await cleanup(prisma, {
      tenantIds: [tenantA?.tenantId, tenantB?.tenantId].filter(Boolean) as string[],
      userIds: [tenantA?.userId, tenantB?.userId].filter(Boolean) as string[],
    });
    await prisma.onModuleDestroy();
  });

  it('fail-closed: tenant kontextus nélkül a scoped olvasás hibát dob', async () => {
    await expect(prisma.scoped.vehicle.findMany()).rejects.toThrow();
  });

  it('olvasás szűr: az A kontextus CSAK az A tenant járművét látja', async () => {
    // FONTOS: a scoped lekérdezést a runWith callbackjén BELÜL kell await-elni,
    // hogy a Prisma-kiterjesztés (lusta PrismaPromise) az aktív ALS kontextusban
    // fusson – ahogy productionben a middleware a teljes kérést az als.run-ban await-eli.
    const rows = await ctx.runWith(ctxA, async () => await prisma.scoped.vehicle.findMany());

    // Csak A jármű(vei) jönnek vissza, B soha.
    expect(rows.every((v) => v.tenantId === tenantA.tenantId)).toBe(true);
    expect(rows.some((v) => v.id === vehicleAId)).toBe(true);
    expect(rows.some((v) => v.id === vehicleBId)).toBe(false);
    expect(rows.some((v) => v.plate === plateB)).toBe(false);
  });

  it('create injektál: scoped create az aktív tenantId-t teszi a rekordba', async () => {
    const created = await ctx.runWith(
      ctxA,
      async () => await prisma.scoped.vehicle.create({ data: { plate: createdPlate } }),
    );

    expect(created.tenantId).toBe(tenantA.tenantId);

    // Ellenőrzés a nyers system klienssel is.
    const fromSystem = await prisma.system.vehicle.findUnique({
      where: { id: created.id },
    });
    expect(fromSystem?.tenantId).toBe(tenantA.tenantId);
    expect(fromSystem?.plate).toBe(createdPlate);
  });

  it('cross-tenant update no-op: A kontextusból a B rekord nem frissül', async () => {
    // Az "extended where unique" miatt a where: { id, tenantId } nem talál B rekordot
    // A kontextusban → a Prisma update P2025-tel dob.
    await expect(
      ctx.runWith(
        ctxA,
        async () =>
          await prisma.scoped.vehicle.update({
            where: { id: vehicleBId },
            data: { make: 'x' },
          }),
      ),
    ).rejects.toThrow();

    // A B jármű VÁLTOZATLAN (a system kliensen ellenőrizve).
    const vb = await prisma.system.vehicle.findUnique({ where: { id: vehicleBId } });
    expect(vb?.make).toBeNull();
  });

  it('User NINCS scope-olva: kontextus nélkül sem dob, a system is megy', async () => {
    // A User nincs a TENANT_SCOPED_MODELS-ben → a kiterjesztés nem injektál,
    // tenant kontextus nélkül sem dob.
    await expect(prisma.scoped.user.findMany()).resolves.toBeDefined();
    await expect(prisma.system.user.findMany()).resolves.toBeDefined();
  });
});
