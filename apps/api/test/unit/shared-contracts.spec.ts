/**
 * A megosztott kontraktus (`@valloreg/shared`) önkonzisztencia-tesztjei.
 *
 * Ezek tisztán a shared csomag exportált konstansait és segédfüggvényeit
 * ellenőrzik – NINCS Prisma kliens, NINCS NestJS service, hogy a teszt a
 * generált kliens nélkül is fusson.
 */
import {
  // plans
  PlanTier,
  PLAN_LIMITS,
  PLAN_PRICES,
  UNLIMITED,
  isWithinLimit,
  // roles
  TenantRole,
  TENANT_ROLE_RANK,
  hasAtLeastRole,
  // feature flags
  ALL_FEATURE_KEYS,
  // reminders
  ReminderType,
  ReminderKind,
  REMINDER_KIND_BY_TYPE,
  ALL_REMINDER_TYPES,
  // errors
  ErrorCode,
  // categories
  ItemType,
  ItemCategory,
  PartType,
} from '@valloreg/shared';

describe('@valloreg/shared kontraktus önkonzisztencia', () => {
  describe('isWithinLimit', () => {
    it('UNLIMITED esetén mindig true (bármilyen current értékre)', () => {
      expect(isWithinLimit(0, UNLIMITED)).toBe(true);
      expect(isWithinLimit(1, UNLIMITED)).toBe(true);
      expect(isWithinLimit(1_000_000, UNLIMITED)).toBe(true);
    });

    it('true, ha current < limit', () => {
      expect(isWithinLimit(0, 5)).toBe(true);
      expect(isWithinLimit(4, 5)).toBe(true);
    });

    it('false, ha current === limit (egyenlőség = elérte a határt)', () => {
      expect(isWithinLimit(5, 5)).toBe(false);
    });

    it('false, ha current > limit (túllépés)', () => {
      expect(isWithinLimit(6, 5)).toBe(false);
      expect(isWithinLimit(100, 5)).toBe(false);
    });
  });

  describe('hasAtLeastRole + TENANT_ROLE_RANK', () => {
    it('a rangsor szigorúan monoton: VIEWER < ACCOUNTANT < FLEET_MANAGER < ADMIN < OWNER', () => {
      expect(TENANT_ROLE_RANK[TenantRole.VIEWER]).toBeLessThan(
        TENANT_ROLE_RANK[TenantRole.ACCOUNTANT],
      );
      expect(TENANT_ROLE_RANK[TenantRole.ACCOUNTANT]).toBeLessThan(
        TENANT_ROLE_RANK[TenantRole.FLEET_MANAGER],
      );
      expect(TENANT_ROLE_RANK[TenantRole.FLEET_MANAGER]).toBeLessThan(
        TENANT_ROLE_RANK[TenantRole.ADMIN],
      );
      expect(TENANT_ROLE_RANK[TenantRole.ADMIN]).toBeLessThan(
        TENANT_ROLE_RANK[TenantRole.OWNER],
      );
    });

    it('minden TenantRole-hoz van rang, és a rangok egyediek', () => {
      const roles = Object.values(TenantRole);
      const ranks = roles.map((r) => TENANT_ROLE_RANK[r]);
      for (const rank of ranks) {
        expect(typeof rank).toBe('number');
      }
      expect(new Set(ranks).size).toBe(roles.length);
    });

    it('hasAtLeastRole(OWNER, VIEWER) true', () => {
      expect(hasAtLeastRole(TenantRole.OWNER, TenantRole.VIEWER)).toBe(true);
    });

    it('hasAtLeastRole(VIEWER, OWNER) false', () => {
      expect(hasAtLeastRole(TenantRole.VIEWER, TenantRole.OWNER)).toBe(false);
    });

    it('minden szerepkör legalább önmaga rangú (true önmagával)', () => {
      for (const role of Object.values(TenantRole)) {
        expect(hasAtLeastRole(role, role)).toBe(true);
      }
    });
  });

  describe('PLAN_LIMITS', () => {
    const allFeatures = new Set<string>(ALL_FEATURE_KEYS);

    it('minden tier features tömbje részhalmaza az ALL_FEATURE_KEYS-nek', () => {
      for (const tier of Object.values(PlanTier)) {
        for (const feature of PLAN_LIMITS[tier].features) {
          expect(allFeatures.has(feature)).toBe(true);
        }
      }
    });

    it('a PROFESSIONAL és BUSINESS az ÖSSZES feature-t tartalmazza', () => {
      const professional = new Set<string>(PLAN_LIMITS[PlanTier.PROFESSIONAL].features);
      const business = new Set<string>(PLAN_LIMITS[PlanTier.BUSINESS].features);
      for (const feature of ALL_FEATURE_KEYS) {
        expect(professional.has(feature)).toBe(true);
        expect(business.has(feature)).toBe(true);
      }
      expect(professional.size).toBe(ALL_FEATURE_KEYS.length);
      expect(business.size).toBe(ALL_FEATURE_KEYS.length);
    });

    it('minden PlanTier-hez van PLAN_LIMITS bejegyzés', () => {
      for (const tier of Object.values(PlanTier)) {
        expect(PLAN_LIMITS[tier]).toBeDefined();
      }
    });

    it('PLAN_PRICES minden tier-t lefed (numerikus értékkel)', () => {
      for (const tier of Object.values(PlanTier)) {
        expect(typeof PLAN_PRICES[tier]).toBe('number');
      }
      expect(Object.keys(PLAN_PRICES).length).toBe(Object.values(PlanTier).length);
    });
  });

  describe('ReminderType / REMINDER_KIND_BY_TYPE', () => {
    const validKinds = new Set<string>(Object.values(ReminderKind));

    it('minden ReminderType-hoz van REMINDER_KIND_BY_TYPE bejegyzés', () => {
      for (const type of Object.values(ReminderType)) {
        expect(REMINDER_KIND_BY_TYPE[type]).toBeDefined();
      }
    });

    it('minden ALL_REMINDER_TYPES elemhez érvényes ReminderKind tartozik', () => {
      for (const type of ALL_REMINDER_TYPES) {
        expect(validKinds.has(REMINDER_KIND_BY_TYPE[type])).toBe(true);
      }
    });

    it('ALL_REMINDER_TYPES lefedi az összes ReminderType-ot', () => {
      expect(new Set(ALL_REMINDER_TYPES).size).toBe(Object.values(ReminderType).length);
    });
  });

  describe('ErrorCode', () => {
    it('minden kulcs értéke önmagával egyenlő (key === value konvenció)', () => {
      for (const [key, value] of Object.entries(ErrorCode)) {
        expect(value).toBe(key);
      }
    });

    it('az értékek egyediek (nincs duplikátum)', () => {
      const values = Object.values(ErrorCode);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('Kategóriák (categories.ts)', () => {
    it('ItemType: kulcs egyedi értékekkel (nincs duplikátum)', () => {
      const values = Object.values(ItemType);
      expect(new Set(values).size).toBe(values.length);
    });

    it('ItemCategory: egyedi értékek (nincs duplikátum)', () => {
      const values = Object.values(ItemCategory);
      expect(new Set(values).size).toBe(values.length);
    });

    it('PartType: egyedi értékek (nincs duplikátum)', () => {
      const values = Object.values(PartType);
      expect(new Set(values).size).toBe(values.length);
    });

    it('mindegyik kategória-mapping nem üres', () => {
      expect(Object.values(ItemType).length).toBeGreaterThan(0);
      expect(Object.values(ItemCategory).length).toBeGreaterThan(0);
      expect(Object.values(PartType).length).toBeGreaterThan(0);
    });
  });
});
