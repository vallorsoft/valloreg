import type { VehicleRegistrationResult } from '@valloreg/shared';

/**
 * Jármű-regisztráció (forgalmi engedély) extraction port. OCR szövegből a
 * @valloreg/shared `VehicleRegistrationResult` szerződést készíti.
 */
export interface VehicleExtractionContext {
  tenantId: string;
  /** Opcionális nyelvi hint (hu/ro/en). */
  locale?: string;
}

export interface VehicleExtractionProvider {
  extractVehicle(
    ocrText: string,
    ctx: VehicleExtractionContext,
  ): Promise<VehicleRegistrationResult>;
}

/** DI token az aktuális VehicleExtractionProvider implementációhoz. */
export const VEHICLE_EXTRACTION_PROVIDER = Symbol('VEHICLE_EXTRACTION_PROVIDER');
