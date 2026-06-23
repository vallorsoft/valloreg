import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import type {
  VehicleVerificationData,
  VehicleVerificationInput,
  VehicleVerificationProvider,
} from '../verification.provider';

/**
 * RO megfelelőség-ellenőrző (ITP / RCA / rovinietă) egy KÜLSŐ adat-API-n
 * keresztül. A RO hatósági/biztosítói adatok nincsenek garantált nyílt API-ban,
 * ezért itt egy KONFIGURÁLHATÓ végpontot hívunk (kereskedelmi adatszolgáltató
 * vagy saját proxy). A várt JSON-válasz:
 *   { status, itpValidUntil, rcaValidUntil, vignetteValidUntil }  (ISO dátumok)
 *
 * Ha nincs RO_VERIFY_API_URL beállítva, NEM hívunk semmit – `error` státuszt
 * adunk vissza (a service ilyenkor nem ír felül semmit). Így az app valódi
 * forrás nélkül is biztonságosan fut.
 */
@Injectable()
export class RoVerificationProvider implements VehicleVerificationProvider {
  private readonly logger = new Logger(RoVerificationProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async verify(
    input: VehicleVerificationInput,
  ): Promise<VehicleVerificationData> {
    const { apiUrl, apiKey } = this.config.roVerify;
    if (!apiUrl) {
      this.logger.warn(
        'VEHICLE_VERIFY_PROVIDER=ro, de RO_VERIFY_API_URL hiányzik – nincs valódi lekérdezés.',
      );
      return this.empty('error');
    }

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ plate: input.plate, vin: input.vin, country: 'RO' }),
      });
      if (!res.ok) {
        this.logger.warn(`RO verify API hiba: ${res.status}`);
        return this.empty('error');
      }
      const data = (await res.json()) as Partial<VehicleVerificationData>;
      return {
        status: data.status === 'not_found' ? 'not_found' : 'ok',
        source: 'ro',
        itpValidUntil: data.itpValidUntil ?? null,
        rcaValidUntil: data.rcaValidUntil ?? null,
        vignetteValidUntil: data.vignetteValidUntil ?? null,
      };
    } catch (err) {
      this.logger.warn(`RO verify hívás sikertelen: ${(err as Error).message}`);
      return this.empty('error');
    }
  }

  private empty(status: VehicleVerificationData['status']): VehicleVerificationData {
    return {
      status,
      source: 'ro',
      itpValidUntil: null,
      rcaValidUntil: null,
      vignetteValidUntil: null,
    };
  }
}
