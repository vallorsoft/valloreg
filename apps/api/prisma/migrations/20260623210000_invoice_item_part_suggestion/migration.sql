-- Számlatétel: alkatrész cikkszám + normalizált alkatrész-identitás (partKey),
-- és a csere-előzményből számolt jármű-JAVASLAT mezői. Mind opcionális,
-- additív (a meglévő tételek nem törnek el).
ALTER TABLE "invoice_items" ADD COLUMN "articleNumber" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "partKey" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "suggestedVehicleId" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN "suggestionConfidence" DOUBLE PRECISION;
ALTER TABLE "invoice_items" ADD COLUMN "suggestionReason" TEXT;

-- A jármű-javaslat előzmény-lekérdezéséhez (tenant + alkatrész-identitás).
CREATE INDEX "invoice_items_tenantId_partKey_idx" ON "invoice_items"("tenantId", "partKey");
