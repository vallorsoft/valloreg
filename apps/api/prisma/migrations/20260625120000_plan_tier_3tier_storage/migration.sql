-- Csomag-átállás: 4 sávról (STARTER/STANDARD/PROFESSIONAL/BUSINESS) 3 sávra
-- (START/PRO/FLEET) + megvásárolható extra tárhely.
--
-- Leképezés a meglévő előfizetésekre:
--   STARTER       -> START
--   STANDARD      -> PRO   (a megszűnő középső sáv a Pro-ba olvad)
--   PROFESSIONAL  -> PRO
--   BUSINESS      -> FLEET

-- 1) Extra tárhely oszlop a Subscription-höz (GB, alapból 0).
ALTER TABLE "subscriptions" ADD COLUMN "extraStorageGB" INTEGER NOT NULL DEFAULT 0;

-- 2) PlanTier enum újradefiniálása (Postgres nem enged értéket eldobni, ezért
--    új típust hozunk létre, és a USING kifejezésben képezzük a régi értékeket).
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";

CREATE TYPE "PlanTier" AS ENUM ('START', 'PRO', 'FLEET');

ALTER TABLE "subscriptions"
  ALTER COLUMN "planTier" TYPE "PlanTier"
  USING (
    CASE "planTier"::text
      WHEN 'STARTER' THEN 'START'
      WHEN 'STANDARD' THEN 'PRO'
      WHEN 'PROFESSIONAL' THEN 'PRO'
      WHEN 'BUSINESS' THEN 'FLEET'
      ELSE 'START'
    END::"PlanTier"
  );

DROP TYPE "PlanTier_old";
