-- AlterTable
ALTER TABLE "billing_settings" ADD COLUMN     "regCom" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "euid" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactEmail" TEXT NOT NULL DEFAULT '';
