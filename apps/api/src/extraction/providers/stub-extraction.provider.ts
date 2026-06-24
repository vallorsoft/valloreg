import { Injectable } from '@nestjs/common';
import {
  ItemCategory,
  ItemType,
  parseExtractionResult,
  PartType,
} from '@valloreg/shared';
import type { ExtractionResult } from '@valloreg/shared';
import type {
  ExtractionContext,
  ExtractionProvider,
} from '../extraction.provider';

/**
 * Determinisztikus stub extraction. Hihető magyar mintaadatot ad vissza, és a
 * shared `parseExtractionResult` séma ELLENŐRZI is – így garantáltan érvényes
 * `ExtractionResult`-ot kapunk (a worker ugyanezzel a sémával dolgozik).
 *
 * A confidence szándékosan 0.85 (>= 0.8), hogy a happy path az AUTO_OK ágat
 * járja be tesztben; review-hoz csökkenthető.
 */
@Injectable()
export class StubExtractionProvider implements ExtractionProvider {
  extract(
    _ocrText: string,
    _ctx: ExtractionContext,
  ): Promise<ExtractionResult> {
    const raw = {
      invoice: {
        supplier: 'Autószerviz Kft.',
        date: '2026-06-15',
        invoiceNumber: 'SZ-2026-0001',
        currency: 'RON',
        odometerKm: 152340,
        netTotal: 48500,
        taxTotal: 13095,
        grossTotal: 61595,
        vehicleCandidates: [
          {
            plate: 'ABC-123',
            vin: null,
            vehicleId: null,
            source: 'plate' as const,
            confidence: 0.9,
          },
        ],
        confidence: 0.85,
      },
      items: [
        {
          name: 'Fékbetét csere (első)',
          category: ItemCategory.PART,
          partType: PartType.BRAKES,
          type: ItemType.VEHICLE,
          articleNumber: 'FB-1234',
          vehicleId: null,
          quantity: 2,
          unitPrice: 9000,
          price: 18000,
          confidence: 0.88,
        },
        {
          name: 'Olajcsere 5W30 motorolaj',
          category: ItemCategory.CONSUMABLE,
          partType: PartType.FLUIDS,
          type: ItemType.VEHICLE,
          articleNumber: null,
          vehicleId: null,
          quantity: 4,
          unitPrice: 3000,
          price: 12000,
          confidence: 0.86,
        },
        {
          name: 'Olajszűrő',
          category: ItemCategory.PART,
          partType: PartType.FILTERS,
          type: ItemType.VEHICLE,
          articleNumber: 'OF-9988',
          vehicleId: null,
          quantity: 1,
          unitPrice: 3500,
          price: 3500,
          confidence: 0.84,
        },
        {
          name: 'Munkadíj',
          category: ItemCategory.LABOR,
          partType: null,
          type: ItemType.VEHICLE,
          articleNumber: null,
          vehicleId: null,
          quantity: 1,
          unitPrice: 15000,
          price: 15000,
          confidence: 0.9,
        },
      ],
      uncertainFields: [],
    };

    // A shared sémával validálunk (single source of truth).
    return Promise.resolve(parseExtractionResult(raw));
  }
}

// A valódi (Gemini) implementáció: ./gemini-extraction.provider.ts
// (modell-lánccal, a shared ExtractionResult szerződést adja vissza).
// Részletek: docs/OCR_AI_ENGINE.md.
