-- Vehicle bővített műszaki adatok (forgalmiból kiolvasva, mind opcionális)
ALTER TABLE "vehicles" ADD COLUMN "firstRegistration" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN "vehicleType" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "category" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "fuelType" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "engineCm3" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "powerKw" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "color" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "seats" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "maxMassKg" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "kerbWeightKg" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN "euroClass" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "typeApproval" TEXT;

-- CreateTable: jármű felei (tulajdonos C.2 / üzembentartó-lízingbevevő C.1)
CREATE TABLE "vehicle_parties" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "partyType" TEXT NOT NULL DEFAULT 'person',
    "name" TEXT,
    "address" TEXT,
    "idNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_parties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_parties_tenantId_idx" ON "vehicle_parties"("tenantId");
CREATE INDEX "vehicle_parties_tenantId_vehicleId_idx" ON "vehicle_parties"("tenantId", "vehicleId");
CREATE UNIQUE INDEX "vehicle_parties_tenantId_vehicleId_role_key" ON "vehicle_parties"("tenantId", "vehicleId", "role");

-- AddForeignKey
ALTER TABLE "vehicle_parties" ADD CONSTRAINT "vehicle_parties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_parties" ADD CONSTRAINT "vehicle_parties_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
