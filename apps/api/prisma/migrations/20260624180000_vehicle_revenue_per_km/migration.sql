-- Opcionális bevétel/km a valós rentabilitás ranglistához. A meglévő
-- járműveket nem érinti (nullable).
-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "revenuePerKm" DECIMAL(65,30);
