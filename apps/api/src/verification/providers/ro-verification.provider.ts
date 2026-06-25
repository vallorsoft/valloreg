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
        // Ne lógjon be egy lassú/akadó upstream a háttér-feldolgozást.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`RO verify API hiba: ${res.status}`);
        return this.empty('error');
      }
      // Méret-korlát: egy ellenséges/hibás upstream ne tudjon memóriát kimeríteni.
      const declaredLen = Number(res.headers.get('content-length') ?? 0);
      if (declaredLen > 100_000) {
        this.logger.warn(`RO verify válasz túl nagy (${declaredLen} bájt) – elvetve.`);
        return this.empty('error');
      }
      const data = (await res.json()) as Partial<VehicleVerificationData>;
      // A külső dátumokat NEM bízzuk meg: csak érvényes ISO dátum megy tovább,
      // különben null (különben a service `new Date(...)`-je Invalid Date lenne).
      const validDate = (v: unknown): string | null => {
        if (typeof v !== 'string') return null;
        return Number.isNaN(Date.parse(v)) ? null : v;
      };
      return {
        status: data.status === 'not_found' ? 'not_found' : 'ok',
        source: 'ro',
        itpValidUntil: validDate(data.itpValidUntil),
        rcaValidUntil: validDate(data.rcaValidUntil),
        vignetteValidUntil: validDate(data.vignetteValidUntil),
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
