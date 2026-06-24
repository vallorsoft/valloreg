-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "benchmarkOptIn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "fleet_benchmarks" (
    "id" TEXT NOT NULL,
    "makeModel" TEXT NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "kmBucket" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "medianUnitPrice" DECIMAL(65,30) NOT NULL,
    "p25" DECIMAL(65,30) NOT NULL,
    "p75" DECIMAL(65,30) NOT NULL,
    "sampleTenants" INTEGER NOT NULL,
    "sampleVehicles" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fleet_benchmarks_makeModel_itemCategory_kmBucket_currency_key" ON "fleet_benchmarks"("makeModel", "itemCategory", "kmBucket", "currency");
