-- Nagy alkatrész esemény (fődarab csere / felújítás). A meglévő adatokat nem
-- érinti; a jármű törlésekor kaszkád törlődik.
-- CreateTable
CREATE TABLE "major_component_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'replacement',
    "title" TEXT,
    "odometerKm" INTEGER,
    "date" TIMESTAMP(3),
    "partsCost" DECIMAL(65,30),
    "laborCost" DECIMAL(65,30),
    "totalCost" DECIMAL(65,30),
    "currency" TEXT,
    "invoiceId" TEXT,
    "itemIds" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "major_component_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "major_component_events_tenantId_idx" ON "major_component_events"("tenantId");

-- CreateIndex
CREATE INDEX "major_component_events_tenantId_vehicleId_idx" ON "major_component_events"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "major_component_events_tenantId_component_idx" ON "major_component_events"("tenantId", "component");

-- AddForeignKey
ALTER TABLE "major_component_events" ADD CONSTRAINT "major_component_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_component_events" ADD CONSTRAINT "major_component_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
