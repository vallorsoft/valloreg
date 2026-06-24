-- Vásárolt extra tárhely GB-ban (a csomag-tárhely fölé). A meglévő cégeket nem
-- érinti (default 0).
-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "extraStorageGb" INTEGER NOT NULL DEFAULT 0;
