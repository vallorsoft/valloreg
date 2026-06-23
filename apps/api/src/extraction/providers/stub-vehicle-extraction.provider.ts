import { Injectable } from '@nestjs/common';
import { parseVehicleRegistration } from '@valloreg/shared';
import type { VehicleRegistrationResult } from '@valloreg/shared';
import type {
  VehicleExtractionContext,
  VehicleExtractionProvider,
} from '../vehicle-extraction.provider';

/**
 * Determinisztikus stub: hihető magyar forgalmi-mintaadatot ad vissza, a shared
 * sémával validálva. Dev/teszt, illetve ha nincs Gemini kulcs.
 */
@Injectable()
export class StubVehicleExtractionProvider
  implements VehicleExtractionProvider
{
  extractVehicle(
    _ocrText: string,
    _ctx: VehicleExtractionContext,
  ): Promise<VehicleRegistrationResult> {
    const raw = {
      plate: 'ABC-123',
      vin: 'WDB1234567890ABCD',
      make: 'Mercedes-Benz',
      model: 'Actros',
      year: 2020,
      firstRegistration: '2020-03-15',
      fuelType: 'dízel',
      engineCm3: 12800,
      powerKw: 315,
      color: 'fehér',
      category: 'N3',
      ownerName: 'Demo Fuvar Kft.',
      confidence: 0.82,
      uncertainFields: [],
    };
    return Promise.resolve(parseVehicleRegistration(raw));
  }
}
