-- CreateTable: forgalmi-beolvasás aszinkron háttér-job állapota és eredménye
CREATE TABLE "vehicle_scans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "files" JSONB NOT NULL,
    "draft" JSONB,
    "matchedVehicleId" TEXT,
    "looksLikeRegistration" BOOLEAN,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_scans_tenantId_idx" ON "vehicle_scans"("tenantId");

-- AddForeignKey
ALTER TABLE "vehicle_scans" ADD CONSTRAINT "vehicle_scans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
