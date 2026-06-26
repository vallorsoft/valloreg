import { z } from 'zod';
import { ItemCategory, ItemType, PartType } from './categories';

/**
 * Az OCR + AI motor (Fázis 2) kimeneti szerződése.
 *
 * Ez a single source of truth: a backend extraction worker ezzel validál,
 * a frontend review UI ebből építkezik. A séma a spec JSON-jára épül,
 * de bővítve van a megbízható feldolgozáshoz szükséges mezőkkel.
 */

/**
 * A feltöltött dokumentum AI-osztályozása. A feldolgozó először ELDÖNTI, milyen
 * típusú a fájl, és csak a `invoice` típusból készít számlát; a többit csak
 * jelzi (a felhasználó a megfelelő helyre tudja vinni).
 */
export const DocumentType = {
  /** Szervizszámla (ebből készül Invoice + tételek). */
  INVOICE: 'invoice',
  /** Forgalmi engedély (jármű-regisztráció). */
  REGISTRATION: 'registration',
  /** Megfelelőségi igazolás (ITP/RCA/rovinietă, biztosítás stb.). */
  COMPLIANCE: 'compliance',
  /** Egyéb / nem felismert. */
  OTHER: 'other',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/** Egy lehetséges jármű-azonosító, amit a motor a számlán talált/sejt. */
export const VehicleCandidateSchema = z.object({
  /** Felismert rendszám, ha van. */
  plate: z.string().nullable().default(null),
  /** Felismert alvázszám (VIN), ha van. */
  vin: z.string().nullable().default(null),
  /** Az adatbázisban már létező jármű id-je, ha a matching engine talált egyezést. */
  vehicleId: z.string().uuid().nullable().default(null),
  /** Mire alapozza a motor a jelöltet. */
  source: z
    .enum(['plate', 'vin', 'supplier_pattern', 'history', 'manual'])
    .default('plate'),
  /** 0.0–1.0 megbízhatóság. */
  confidence: z.number().min(0).max(1).default(0),
});
export type VehicleCandidate = z.infer<typeof VehicleCandidateSchema>;

/** A számla fej-adatai. */
export const ExtractedInvoiceSchema = z.object({
  supplier: z.string().default(''),
  /** ISO dátum (YYYY-MM-DD), ha értelmezhető. */
  date: z.string().default(''),
  invoiceNumber: z.string().default(''),
  /** ISO 4217 pénznem (pl. RON, EUR). */
  currency: z.string().default(''),
  /** Kilométeróra-állás, ha szerepel a számlán. */
  odometerKm: z.number().int().nonnegative().nullable().default(null),
  netTotal: z.number().nullable().default(null),
  taxTotal: z.number().nullable().default(null),
  grossTotal: z.number().nullable().default(null),
  /** Lehetséges járművek a számlán. */
  vehicleCandidates: z.array(VehicleCandidateSchema).default([]),
  /** A fej-adatok összesített megbízhatósága. */
  confidence: z.number().min(0).max(1).default(0),
});
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

/** Egy számlatétel. */
export const ExtractedItemSchema = z.object({
  name: z.string().default(''),
  category: z.nativeEnum(ItemCategory).default(ItemCategory.OTHER),
  /** Alkatrész-típus, ha releváns (fék, motor, szűrő…). */
  partType: z.nativeEnum(PartType).nullable().default(null),
  /**
   * A számlán szereplő alkatrész cikkszám / cikkkód (pl. "FB-1234", OEM-szám),
   * ha látható. Ez az alkatrész legpontosabb azonosítója: ebből épül a
   * jármű-javaslat (mely járművekre lett már felrakva ugyanez a cikkszám).
   * Ha nincs a számlán, `null` – ekkor a típus + név alapján képződik kulcs.
   */
  articleNumber: z.string().nullable().default(null),
  /** vehicle | tool | general */
  type: z.nativeEnum(ItemType).default(ItemType.GENERAL),
  /** Ha a motor konkrét meglévő járműhöz kötötte. */
  vehicleId: z.string().uuid().nullable().default(null),
  quantity: z.number().default(1),
  unitPrice: z.number().nullable().default(null),
  /** A tétel ára (nettó vagy bruttó a számla szerint). */
  price: z.number().default(0),
  /** Tételszintű megbízhatóság. */
  confidence: z.number().min(0).max(1).default(0),
});
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

/** Egy bizonytalan mező, amit a felhasználónak meg kell erősítenie. */
export const UncertainFieldSchema = z.object({
  /** Pl. "invoice.date", "items[2].vehicleId". */
  path: z.string(),
  reason: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0),
});
export type UncertainField = z.infer<typeof UncertainFieldSchema>;

/** A motor teljes kimenete (a spec JSON kontraktusa, kibővítve). */
export const ExtractionResultSchema = z.object({
  /**
   * A dokumentum osztályozása. Ha nem `invoice`, a worker NEM készít belőle
   * számlát, csak jelzi a típust. Alapértelmezés `invoice` a visszafelé-
   * kompatibilitásért (a régi providerek számlát adnak vissza).
   */
  documentType: z.nativeEnum(DocumentType).default(DocumentType.INVOICE),
  invoice: ExtractedInvoiceSchema,
  items: z.array(ExtractedItemSchema).default([]),
  uncertainFields: z.array(UncertainFieldSchema).default([]),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Biztonságos parse: ismeretlen/AI-eredetű JSON-t validál és kitölti a
 * hiányzó mezőket alapértelmezésekkel. Hibát dob, ha a szerkezet menthetetlen.
 */
export function parseExtractionResult(input: unknown): ExtractionResult {
  return ExtractionResultSchema.parse(input);
}

/** Nem dobó változat – hibák a `error` mezőben. */
export function safeParseExtractionResult(input: unknown) {
  return ExtractionResultSchema.safeParse(input);
}
