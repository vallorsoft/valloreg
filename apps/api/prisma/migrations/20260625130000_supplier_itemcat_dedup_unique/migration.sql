-- ════════════════════════════════════════════════════════════════════════
-- TC7 + TC8: deduplikálás + unique constraintek (concurrency race-ek lezárása)
--
-- 1) Supplier: (tenantId, normalizedName) duplikátumok összevonása + UNIQUE.
--    A duplikátumokra mutató FK-kat (Invoice, SupplierVehicleMapping,
--    ItemCategoryMapping) a kanonikus beszállítóra irányítjuk át, majd a
--    duplikátumokat töröljük.
-- 2) ItemCategoryMapping: (tenantId, supplierId, pattern, category, type)
--    duplikátumok súly-összevonása + UNIQUE.
--
-- A művelet IDEMPOTENS jellegű és önmagában fut (egy tranzakcióban). A tanuló
-- táblákon (supplier_vehicle_mappings, item_category_mappings) delete+reinsert
-- mintát használunk a súlyok biztonságos összevonásához.
-- gen_random_uuid() a PostgreSQL 13+ magjának része (Neon PG15+), nincs extension.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) SUPPLIER DEDUP ───────────────────────────────────────────────────

-- Kanonikus beszállító csoportonként (legrégebbi createdAt, döntetlen: id).
CREATE TEMP TABLE _supplier_canon AS
SELECT DISTINCT ON ("tenantId", "normalizedName")
       "tenantId", "normalizedName", id AS canonical_id
FROM "suppliers"
ORDER BY "tenantId", "normalizedName", "createdAt" ASC, id ASC;

-- dupe_id -> canonical_id (csak a nem-kanonikus sorok).
CREATE TEMP TABLE _supplier_dupe AS
SELECT s.id AS dupe_id, c.canonical_id
FROM "suppliers" s
JOIN _supplier_canon c
  ON s."tenantId" = c."tenantId" AND s."normalizedName" = c."normalizedName"
WHERE s.id <> c.canonical_id;

-- Invoice.supplierId átirányítás a kanonikusra (nincs unique a supplierId-n).
UPDATE "invoices" i
SET "supplierId" = d.canonical_id
FROM _supplier_dupe d
WHERE i."supplierId" = d.dupe_id;

-- ItemCategoryMapping.supplierId átirányítás (a TC8 dedup ezután összevon).
UPDATE "item_category_mappings" m
SET "supplierId" = d.canonical_id
FROM _supplier_dupe d
WHERE m."supplierId" = d.dupe_id;

-- SupplierVehicleMapping: a (tenantId, supplierId, vehicleId) UNIQUE miatt
-- delete+reinsert mintával vonjuk össze a súlyokat a kanonikus beszállítóra.
CREATE TEMP TABLE _svm_merged AS
SELECT
  COALESCE(d.canonical_id, svm."supplierId") AS supplier_id,
  svm."tenantId" AS tenant_id,
  svm."vehicleId" AS vehicle_id,
  SUM(svm.weight)::int AS total_weight
FROM "supplier_vehicle_mappings" svm
LEFT JOIN _supplier_dupe d ON svm."supplierId" = d.dupe_id
WHERE svm."supplierId" IN (SELECT dupe_id FROM _supplier_dupe)
   OR svm."supplierId" IN (SELECT canonical_id FROM _supplier_dupe)
GROUP BY 1, 2, 3;

DELETE FROM "supplier_vehicle_mappings" svm
WHERE svm."supplierId" IN (SELECT dupe_id FROM _supplier_dupe)
   OR svm."supplierId" IN (SELECT canonical_id FROM _supplier_dupe);

INSERT INTO "supplier_vehicle_mappings" (id, "tenantId", "supplierId", "vehicleId", weight, "createdAt")
SELECT gen_random_uuid(), tenant_id, supplier_id, vehicle_id, total_weight, now()
FROM _svm_merged;

-- A duplikátum beszállítók törlése.
DELETE FROM "suppliers" s
WHERE s.id IN (SELECT dupe_id FROM _supplier_dupe);

-- UNIQUE a beszállítókra + a régi, immár redundáns index eldobása.
DROP INDEX IF EXISTS "suppliers_tenantId_normalizedName_idx";
CREATE UNIQUE INDEX "suppliers_tenantId_normalizedName_key"
  ON "suppliers"("tenantId", "normalizedName");

-- ── 2) ITEMCATEGORYMAPPING DEDUP ────────────────────────────────────────
-- Csoport: (tenantId, supplierId, pattern, category, type). A GROUP BY a NULL
-- supplierId-t egyetlen csoportnak veszi, így a súlyokat helyesen összevonja.
-- A tábla LEAF (nincs rá FK), ezért biztonságos a teljes delete+reinsert.

CREATE TEMP TABLE _icm_merged AS
SELECT
  "tenantId"   AS tenant_id,
  "supplierId" AS supplier_id,
  "pattern"    AS pattern,
  "category"   AS category,
  "type"       AS type,
  SUM(weight)::int AS total_weight,
  MIN("createdAt") AS created_at
FROM "item_category_mappings"
GROUP BY "tenantId", "supplierId", "pattern", "category", "type";

DELETE FROM "item_category_mappings";

INSERT INTO "item_category_mappings"
  (id, "tenantId", "supplierId", "pattern", "category", "type", weight, "createdAt")
SELECT gen_random_uuid(), tenant_id, supplier_id, pattern, category, type, total_weight, created_at
FROM _icm_merged;

-- UNIQUE a tanuló-mappingekre (NULL supplierId-t a Postgres különbözőnek veszi;
-- a beszállító nélküli race-t a service findFirst+increment ága fedi).
CREATE UNIQUE INDEX "item_cat_map_unique"
  ON "item_category_mappings"("tenantId", "supplierId", "pattern", "category", "type");
