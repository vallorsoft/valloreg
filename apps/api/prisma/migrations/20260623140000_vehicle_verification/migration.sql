-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "vehicle_verifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itpValidUntil" TIMESTAMP(3),
    "rcaValidUntil" TIMESTAMP(3),
    "vignetteValidUntil" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_verifications_vehicleId_key" ON "vehicle_verifications"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_verifications_tenantId_idx" ON "vehicle_verifications"("tenantId");

-- AddForeignKey
ALTER TABLE "vehicle_verifications" ADD CONSTRAINT "vehicle_verifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_verifications" ADD CONSTRAINT "vehicle_verifications_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
