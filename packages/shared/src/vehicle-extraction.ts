import { z } from 'zod';
import { UncertainFieldSchema } from './extraction';

/**
 * Forgalmi engedély (jármű regisztrációs dokumentum) kiolvasásának kimeneti
 * szerződése. Külön a számla `ExtractionResult`-tól: más a domain.
 *
 * A mezők egy része a Vehicle modellre képződik (plate, vin, make, model, year),
 * a többi (üzemanyag, teljesítmény, szín, tulajdonos) jelenleg csak ellenőrzésre
 * jelenik meg – a tulajdonos nevét (személyes adat) NEM perzisztáljuk.
 */
export const VehicleRegistrationResultSchema = z.object({
  /** Rendszám (HU "A" mező / RO nr. înmatriculare). */
  plate: z.string().nullable().default(null),
  /** Alvázszám / VIN (HU "E" mező). */
  vin: z.string().nullable().default(null),
  /** Gyártmány (marca). */
  make: z.string().nullable().default(null),
  /** Típus / kereskedelmi megnevezés. */
  model: z.string().nullable().default(null),
  /** Évjárat (ha értelmezhető a forgalomba helyezésből). */
  year: z.number().int().nullable().default(null),
  /** Első forgalomba helyezés ISO dátuma (YYYY-MM-DD), ha van. */
  firstRegistration: z.string().nullable().default(null),
  /** Üzemanyag (pl. dízel, benzin, elektromos). */
  fuelType: z.string().nullable().default(null),
  /** Hengerűrtartalom cm³. */
  engineCm3: z.number().int().nullable().default(null),
  /** Teljesítmény kW. */
  powerKw: z.number().int().nullable().default(null),
  /** Szín. */
  color: z.string().nullable().default(null),
  /** Jármű-kategória (M1, N1, …). */
  category: z.string().nullable().default(null),
  /** Tulajdonos neve – SZEMÉLYES ADAT, csak ellenőrzéshez; nem perzisztáljuk. */
  ownerName: z.string().nullable().default(null),
  /** A kiolvasás összesített megbízhatósága (0–1). */
  confidence: z.number().min(0).max(1).default(0),
  /** Bizonytalan/hiányzó mezők (path + ok + confidence). */
  uncertainFields: z.array(UncertainFieldSchema).default([]),
});

export type VehicleRegistrationResult = z.infer<
  typeof VehicleRegistrationResultSchema
>;

/** Validál + kitölti a defaultokat (single source of truth). */
export function parseVehicleRegistration(
  input: unknown,
): VehicleRegistrationResult {
  return VehicleRegistrationResultSchema.parse(input);
}
