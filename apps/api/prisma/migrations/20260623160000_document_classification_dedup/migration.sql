-- AlterEnum: dokumentum-osztályozás + duplikátum státuszok
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'NOT_INVOICE';
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'DUPLICATE';

-- AlterTable: AI-osztályozott típus + tartalmi duplikátum-hivatkozás
ALTER TABLE "documents" ADD COLUMN "docType" TEXT;
ALTER TABLE "documents" ADD COLUMN "duplicateOfId" TEXT;

-- CreateIndex
CREATE INDEX "documents_duplicateOfId_idx" ON "documents"("duplicateOfId");

-- AddForeignKey: duplikátum → eredeti (az eredeti törlésekor a hivatkozás nullázódik)
ALTER TABLE "documents" ADD CONSTRAINT "documents_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
