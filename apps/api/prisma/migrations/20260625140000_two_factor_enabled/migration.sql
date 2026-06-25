-- AlterTable: 2FA aktiválás időbélyege (csak nem-null esetén ENABLED a 2FA)
ALTER TABLE "users" ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);
