/**
 * Jármű megfelelőség-ellenőrző port (RO: ITP / RCA / rovinietă). A meglévő
 * provider-mintát követi (stub + valódi implementáció, factory-val választva).
 */
export interface VehicleVerificationInput {
  plate: string | null;
  vin: string | null;
  /** ISO ország-kód hint (jelenleg "RO"). */
  country: string | null;
}

export interface VehicleVerificationData {
  status: 'ok' | 'not_found' | 'error';
  source: string;
  /** Műszaki (ITP) érvényesség ISO dátuma (YYYY-MM-DD) vagy null. */
  itpValidUntil: string | null;
  /** Kötelező biztosítás (RCA) érvényesség. */
  rcaValidUntil: string | null;
  /** Autópálya-matrica (rovinietă) érvényesség. */
  vignetteValidUntil: string | null;
}

export interface VehicleVerificationProvider {
  verify(input: VehicleVerificationInput): Promise<VehicleVerificationData>;
}

export const VEHICLE_VERIFICATION_PROVIDER = Symbol(
  'VEHICLE_VERIFICATION_PROVIDER',
);
