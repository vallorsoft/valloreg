import { z } from 'zod';
import { UncertainFieldSchema } from './extraction';

/** Egy fél (tulajdonos vagy üzembentartó) típusa: magánszemély vagy cég. */
export const VehiclePartyType = {
  PERSON: 'person',
  COMPANY: 'company',
} as const;
export type VehiclePartyType =
  (typeof VehiclePartyType)[keyof typeof VehiclePartyType];

/** Egy fél szerepe a járművön: tulajdonos (C.2) vagy üzembentartó/lízingbevevő (C.1). */
export const VehiclePartyRole = {
  OWNER: 'owner',
  USER: 'user',
} as const;
export type VehiclePartyRole =
  (typeof VehiclePartyRole)[keyof typeof VehiclePartyRole];

/**
 * Forgalmi engedély (jármű regisztrációs dokumentum) kiolvasásának kimeneti
 * szerződése. Külön a számla `ExtractionResult`-tól: más a domain.
 *
 * A mezők a Vehicle modellre képződnek; a tulajdonos (C.2) és üzembentartó (C.1)
 * a VehicleParty táblába kerül (név, cím, CNP/CUI). Minden mező a megerősítés
 * előtt szerkeszthető a kliensen.
 */
export const VehicleRegistrationResultSchema = z.object({
  /** Rendszám (HU "A" mező / RO nr. înmatriculare). */
  plate: z.string().nullable().default(null),
  /** Alvázszám / VIN (HU "E" mező). */
  vin: z.string().nullable().default(null),
  /** Gyártmány (marca). */
  make: z.string().nullable().default(null),
  /** Típus / kereskedelmi megnevezés (D.3). */
  model: z.string().nullable().default(null),
  /** Típus/variáns/verzió (D.2). */
  vehicleType: z.string().nullable().default(null),
  /** Évjárat (ha értelmezhető a forgalomba helyezésből). */
  year: z.number().int().nullable().default(null),
  /** Első forgalomba helyezés ISO dátuma (YYYY-MM-DD), ha van. */
  firstRegistration: z.string().nullable().default(null),
  /** Üzemanyag (pl. dízel, benzin, elektromos). */
  fuelType: z.string().nullable().default(null),
  /** Hengerűrtartalom cm³ (P.1). */
  engineCm3: z.number().int().nullable().default(null),
  /** Teljesítmény kW (P.2). */
  powerKw: z.number().int().nullable().default(null),
  /** Szín (R). */
  color: z.string().nullable().default(null),
  /** Jármű-kategória (J – M1, N1, …). */
  category: z.string().nullable().default(null),
  /** Ülőhelyek száma (S.1). */
  seats: z.number().int().nullable().default(null),
  /** Megengedett legnagyobb tömeg kg (F.1). */
  maxMassKg: z.number().int().nullable().default(null),
  /** Saját tömeg kg (G). */
  kerbWeightKg: z.number().int().nullable().default(null),
  /** Emissziós osztály / Euro (V.9). */
  euroClass: z.string().nullable().default(null),
  /** Típusjóváhagyási szám (K). */
  typeApproval: z.string().nullable().default(null),

  // ── Tulajdonos (C.2) – SZEMÉLYES ADAT, a confirm a VehicleParty táblába menti.
  /** Tulajdonos neve. */
  ownerName: z.string().nullable().default(null),
  /** Tulajdonos címe. */
  ownerAddress: z.string().nullable().default(null),
  /** Tulajdonos típusa: "person" | "company". */
  ownerType: z.string().nullable().default(null),
  /** Tulajdonos CNP-je (magánszemély) vagy CUI-ja (cég). */
  ownerIdNumber: z.string().nullable().default(null),

  // ── Üzembentartó / lízingbevevő (C.1) – SZEMÉLYES ADAT.
  /** Üzembentartó neve. */
  userName: z.string().nullable().default(null),
  /** Üzembentartó címe. */
  userAddress: z.string().nullable().default(null),
  /** Üzembentartó típusa: "person" | "company". */
  userType: z.string().nullable().default(null),
  /** Üzembentartó CNP-je (magánszemély) vagy CUI-ja (cég). */
  userIdNumber: z.string().nullable().default(null),

  /** A kiolvasás összesített megbízhatósága (0–1). */
  confidence: z.number().min(0).max(1).default(0),
  /** Bizonytalan/hiányzó mezők (path + ok + confidence). */
  uncertainFields: z.array(UncertainFieldSchema).default([]),
});

export type VehicleRegistrationResult = z.infer<
  typeof VehicleRegistrationResultSchema
>;

/**
 * A forgalmi-beolvasás (OCR + AI) háttér-feldolgozásának állapotai. A beolvasás
 * aszinkron: a kliens egy `scanId`-t kap, és lekérdezéssel (polling) követi az
 * állapotot, amíg `DONE`/`FAILED` nem lesz. Így a hosszú OCR+AI nem a HTTP-kérés
 * idejét terheli (nincs időtúllépés / "Failed to fetch" hideg indításkor).
 */
export const VehicleScanStatus = {
  PENDING: 'PENDING',
  OCR_RUNNING: 'OCR_RUNNING',
  EXTRACTING: 'EXTRACTING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;

export type VehicleScanStatus =
  (typeof VehicleScanStatus)[keyof typeof VehicleScanStatus];

/** Validál + kitölti a defaultokat (single source of truth). */
export function parseVehicleRegistration(
  input: unknown,
): VehicleRegistrationResult {
  return VehicleRegistrationResultSchema.parse(input);
}
