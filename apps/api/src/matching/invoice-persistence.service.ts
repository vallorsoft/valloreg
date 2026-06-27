import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ItemType } from '@valloreg/shared';
import type { ExtractionResult } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from './matching.service';
import type { VehicleMatch } from './matching.service';
import { normalizePartKey } from './matching.util';

/**
 * Számla (Invoice) + tételek (InvoiceItem) perzisztálása egy `ExtractionResult`
 * alapján. Korábban a `DocumentsProcessor` privát metódusa volt; kiemelve, hogy
 * az OCR-worker ÉS az Excel köteges import UGYANAZT a (matching + javaslat +
 * partKey) logikát használja – egy forrásból.
 *
 * FONTOS: a SYSTEM Prisma klienst használja és a tenantId-t MINDEN where/data-ban
 * EXPLICITEN megadja, mert a worker NEM request-kontextusban fut (nincs tenant
 * AsyncLocalStorage). Request-kontextusból hívva is helyes (a system kliens csak
 * megkerüli az ALS-t; a tenantId expliciten adott).
 */
@Injectable()
export class InvoicePersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matching: MatchingService,
  ) {}

  /** Számla upsert a documentId-re (idempotens) + tételek újraírása. */
  async persist(
    tenantId: string,
    documentId: string,
    extraction: ExtractionResult,
    supplierId: string | null,
    vehicleMatch: VehicleMatch,
  ): Promise<void> {
    const inv = extraction.invoice;

    await this.prisma.system.$transaction(async (tx) => {
      // Számla upsert a documentId-re (idempotens újrafeldolgozáshoz).
      const invoice = await tx.invoice.upsert({
        where: { documentId },
        create: {
          tenantId,
          documentId,
          supplierId,
          invoiceNumber: inv.invoiceNumber || null,
          date: inv.date ? new Date(inv.date) : null,
          currency: inv.currency || null,
          odometerKm: inv.odometerKm ?? null,
          netTotal: inv.netTotal ?? null,
          taxTotal: inv.taxTotal ?? null,
          grossTotal: inv.grossTotal ?? null,
          confidence: inv.confidence,
          extractionRaw: extraction as unknown as Prisma.InputJsonValue,
        },
        update: {
          supplierId,
          invoiceNumber: inv.invoiceNumber || null,
          date: inv.date ? new Date(inv.date) : null,
          currency: inv.currency || null,
          odometerKm: inv.odometerKm ?? null,
          netTotal: inv.netTotal ?? null,
          taxTotal: inv.taxTotal ?? null,
          grossTotal: inv.grossTotal ?? null,
          confidence: inv.confidence,
          extractionRaw: extraction as unknown as Prisma.InputJsonValue,
        },
      });

      // Korábbi tételek törlése, majd újra létrehozás (egyszerű, idempotens).
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id, tenantId },
      });

      if (extraction.items.length > 0) {
        // A javaslat-számításhoz a számla dátuma/km-állása a viszonyítási pont.
        const asOfDate = inv.date ? new Date(inv.date) : new Date();
        const asOfKm = inv.odometerKm ?? null;

        const itemsData: Prisma.InvoiceItemCreateManyInput[] = [];
        for (const item of extraction.items) {
          const partKey = normalizePartKey(item.articleNumber, item.partType, item.name);

          // Jármű-hozzárendelés prioritása: az extrakció által megadott id, majd
          // a matching motor egyezése – csak a jármű-típusú tételekre.
          const vehicleId =
            item.vehicleId ?? (item.type === ItemType.VEHICLE ? vehicleMatch.vehicleId : null);

          // JAVASLAT: csak jármű-típusú alkatrész-tételre, aminek van partKey-je
          // és nincs hard egyezése (különben felesleges – már tudjuk a járművet).
          let suggestion = null;
          if (partKey && item.type === ItemType.VEHICLE && !vehicleId) {
            suggestion = await this.matching.suggestVehicleForItem(
              tenantId,
              partKey,
              item.partType ?? null,
              asOfDate,
              asOfKm,
              invoice.id,
            );
          }

          itemsData.push({
            tenantId,
            invoiceId: invoice.id,
            name: item.name,
            category: item.category,
            partType: item.partType ?? null,
            type: item.type,
            articleNumber: item.articleNumber ?? null,
            partKey,
            vehicleId,
            suggestedVehicleId: suggestion?.vehicleId ?? null,
            suggestionConfidence: suggestion?.confidence ?? null,
            suggestionReason: suggestion?.reason ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? null,
            price: item.price,
            confidence: item.confidence,
          });
        }

        await tx.invoiceItem.createMany({ data: itemsData });
      }
    });
  }
}
