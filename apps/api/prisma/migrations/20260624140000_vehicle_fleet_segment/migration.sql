-- Flotta-szegmens KÉZI felülírás. Alapból NULL → a szegmenst a forgalmiból
-- vezetjük le (fleetSegmentOf). A meglévő járművek nem törnek el (nullable).
-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "fleetSegment" TEXT;
