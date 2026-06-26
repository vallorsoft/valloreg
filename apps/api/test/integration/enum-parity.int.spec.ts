import {
  TenantRole as PrismaTenantRole,
  PlanTier as PrismaPlanTier,
  DocumentStatus as PrismaDocumentStatus,
} from '@prisma/client';
import {
  TenantRole as SharedTenantRole,
  PlanTier as SharedPlanTier,
  DocumentStatus as SharedDocumentStatus,
} from '@valloreg/shared';

/**
 * Prisma ↔ @valloreg/shared string-azonosság. DB nem kell, de a GENERÁLT
 * @prisma/client igen (a Prisma enumok futásidőben objektumok), ezért ez
 * integrációs teszt – nem connectelünk, csak importálunk és összehasonlítunk.
 *
 * MEGJEGYZÉS: a SubscriptionStatus és a SupportAccessStatus enumok a Prisma
 * sémában léteznek, de a @valloreg/shared NEM exportálja őket – ezért itt
 * szándékosan KIMARADNAK (nincs mihez hasonlítani). Ha később bekerülnek a
 * shared-be, vegyük fel ide is.
 */
describe('Enum string-azonosság: Prisma ↔ @valloreg/shared (integráció)', () => {
  const cases: ReadonlyArray<{
    name: string;
    prisma: Record<string, string>;
    shared: Record<string, string>;
  }> = [
    { name: 'TenantRole', prisma: PrismaTenantRole, shared: SharedTenantRole },
    { name: 'PlanTier', prisma: PrismaPlanTier, shared: SharedPlanTier },
    {
      name: 'DocumentStatus',
      prisma: PrismaDocumentStatus,
      shared: SharedDocumentStatus,
    },
  ];

  it.each(cases)(
    '$name értékkészlete pontosan egyezik a két forrásban',
    ({ prisma, shared }) => {
      const prismaValues = new Set(Object.values(prisma));
      const sharedValues = new Set(Object.values(shared));

      // Különbségek kétirányú listázása, hogy buktatáskor látszódjon az eltérés.
      const onlyInPrisma = [...prismaValues].filter((v) => !sharedValues.has(v));
      const onlyInShared = [...sharedValues].filter((v) => !prismaValues.has(v));

      expect(onlyInPrisma).toEqual([]);
      expect(onlyInShared).toEqual([]);
      expect([...prismaValues].sort()).toEqual([...sharedValues].sort());
    },
  );
});
