-- Tartósság KÉZI felülírás cégenként (szegmens + fődarab → várható km).
-- Ha létezik, felülírja a seedet és a tanult értéket. A meglévő adatokat nem
-- érinti; a cég törlésekor kaszkád törlődik.
-- CreateTable
CREATE TABLE "durability_baselines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "expectedKm" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "durability_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "durability_baselines_tenantId_idx" ON "durability_baselines"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "durability_baselines_tenantId_segment_component_key" ON "durability_baselines"("tenantId", "segment", "component");

-- AddForeignKey
ALTER TABLE "durability_baselines" ADD CONSTRAINT "durability_baselines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
