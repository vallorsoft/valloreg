import { randomUUID } from 'node:crypto';
import { TenantRole } from '@valloreg/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import { cleanup, makePrisma, SeededTenant, seedTenant } from './helpers';

/**
 * DB-szintű kényszerek integrációs tesztje: a sémában deklarált unique /
 * cascade / SetNull invariánsok ÉLŐ Postgresen érvényesülnek-e.
 *
 * Minden a `prisma.system` (nem scope-olt) kliensen megy, mert nincs
 * tenant kontextus – itt nem a kód-szintű scope-ot, hanem a DB kényszereket
 * teszteljük. Élő Postgres + generált @prisma/client kell hozzá (a CI futtatja).
 */
describe('DB-szintű kényszerek (integráció)', () => {
  let prisma: PrismaService;
  let ctx: TenantContextService;

  // Az afterAll cleanupban törlendő id-k. A seedTenant által létrehozott User
  // GLOBÁLIS (nem cascade-el a tenanttel) → a userId-ket mindig fel kell venni.
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    ({ prisma, ctx } = makePrisma());
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await cleanup(prisma, { tenantIds, userIds });
    await prisma.onModuleDestroy();
  });

  describe('Unique kényszerek (P2002)', () => {
    it('User.email egyedi: ugyanazzal az emaillel a második create elhasal', async () => {
      const email = `it-${randomUUID()}@example.test`;

      const first = await prisma.system.user.create({
        data: { email, passwordHash: 'x' },
      });
      userIds.push(first.id);

      await expect(
        prisma.system.user.create({ data: { email, passwordHash: 'x' } }),
      ).rejects.toThrow();

      // A hiba kifejezetten az egyedi-kényszer megsértése (Prisma P2002).
      const err = await prisma.system.user
        .create({ data: { email, passwordHash: 'x' } })
        .then(() => null)
        .catch((e) => e);
      expect((err as { code?: string } | null)?.code).toBe('P2002');
    });

    it('Membership egyedi [tenantId, userId]: a második membership elhasal', async () => {
      const seeded = await seedTenant(prisma, TenantRole.OWNER);
      tenantIds.push(seeded.tenantId);
      userIds.push(seeded.userId);

      // Ugyanaz a {tenantId, userId} pár → @@unique megsértése.
      await expect(
        prisma.system.membership.create({
          data: {
            tenantId: seeded.tenantId,
            userId: seeded.userId,
            role: TenantRole.VIEWER,
          },
        }),
      ).rejects.toThrow();

      const err = await prisma.system.membership
        .create({
          data: {
            tenantId: seeded.tenantId,
            userId: seeded.userId,
            role: TenantRole.VIEWER,
          },
        })
        .then(() => null)
        .catch((e) => e);
      expect((err as { code?: string } | null)?.code).toBe('P2002');
    });

    it('Document egyedi [tenantId, sha256]: ugyanaz a sha256 egy tenanton elhasal, más sha256 megy', async () => {
      const seeded = await seedTenant(prisma, TenantRole.OWNER);
      tenantIds.push(seeded.tenantId);
      userIds.push(seeded.userId);

      const sha256 = randomUUID();

      const makeDocData = (hash: string) => ({
        tenantId: seeded.tenantId,
        uploadedById: seeded.userId,
        fileName: `${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        storageKey: `it/${randomUUID()}`,
        sha256: hash,
      });

      const first = await prisma.system.document.create({ data: makeDocData(sha256) });
      expect(first.id).toBeDefined();

      // UGYANAZ a tenant + UGYANAZ a sha256 → @@unique megsértése.
      const err = await prisma.system.document
        .create({ data: makeDocData(sha256) })
        .then(() => null)
        .catch((e) => e);
      expect((err as { code?: string } | null)?.code).toBe('P2002');

      // MÁS sha256 ugyanazon a tenanton VISZONT MENJEN.
      const second = await prisma.system.document.create({
        data: makeDocData(randomUUID()),
      });
      expect(second.id).toBeDefined();
    });
  });

  describe('Cascade / SetNull kényszerek', () => {
    it('Cascade: a tenant törlése a Membershipeket és Vehicle-öket is törli', async () => {
      const seeded = await seedTenant(prisma, TenantRole.OWNER);
      // A tenantId-t NEM tesszük a cleanup listára (itt töröljük), de a
      // GLOBÁLIS User-t igen, mert nem cascade-el a tenanttel.
      userIds.push(seeded.userId);

      await prisma.system.vehicle.create({
        data: { tenantId: seeded.tenantId, plate: `IT-${randomUUID()}` },
      });

      // A tenant törlése – a séma onDelete: Cascade relációi miatt a hozzá
      // tartozó Membership és Vehicle rekordok is eltűnnek.
      await prisma.system.tenant.delete({ where: { id: seeded.tenantId } });

      const membershipCount = await prisma.system.membership.count({
        where: { tenantId: seeded.tenantId },
      });
      const vehicleCount = await prisma.system.vehicle.count({
        where: { tenantId: seeded.tenantId },
      });

      expect(membershipCount).toBe(0);
      expect(vehicleCount).toBe(0);

      // A globális User ELLENBEN megmarad (nem cascade-el a tenanttel).
      const user = await prisma.system.user.findUnique({ where: { id: seeded.userId } });
      expect(user).not.toBeNull();
    });

    it('SetNull: a duplikátum eredetijének törlésekor a duplicateOfId nullázódik', async () => {
      const seeded = await seedTenant(prisma, TenantRole.OWNER);
      tenantIds.push(seeded.tenantId);
      userIds.push(seeded.userId);

      const makeDocData = () => ({
        tenantId: seeded.tenantId,
        uploadedById: seeded.userId,
        fileName: `${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        storageKey: `it/${randomUUID()}`,
        sha256: randomUUID(),
      });

      const original = await prisma.system.document.create({ data: makeDocData() });

      // A duplikátum az eredetire mutat a self-reláción keresztül.
      const dup = await prisma.system.document.create({
        data: { ...makeDocData(), duplicateOfId: original.id },
      });
      expect(dup.duplicateOfId).toBe(original.id);

      // Az EREDETI törlése – a séma onDelete: SetNull miatt a hivatkozás
      // nullázódik, a duplikátum NEM törlődik.
      await prisma.system.document.delete({ where: { id: original.id } });

      const stillThere = await prisma.system.document.findUnique({
        where: { id: dup.id },
      });
      expect(stillThere).not.toBeNull();
      expect(stillThere?.duplicateOfId).toBeNull();
    });
  });

  // A `ctx` itt nincs használva (nem scope-olt teszt), de a makePrisma
  // visszaadja – elérhető marad jövőbeli bővítéshez.
  void ctx;
});
