-- Platform-szintű számla-/utalási adatok (singleton sor, id = "default").
-- A Super Admin szerkeszti; üres mezőnél a billing az env-tartalékra esik vissza.
-- CreateTable
CREATE TABLE "billing_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT '',
    "taxNumber" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "beneficiary" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "swift" TEXT NOT NULL DEFAULT '',
    "notifyEmail" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_settings_pkey" PRIMARY KEY ("id")
);
