import { Injectable } from '@nestjs/common';
import type {
  VehicleVerificationData,
  VehicleVerificationInput,
  VehicleVerificationProvider,
} from '../verification.provider';

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Determinisztikus stub: hihető RO lejáratokat ad (dev / API nélkül).
 * Az ITP ~6 hónap múlva, az RCA ~3 hónap múlva, a rovinietă pedig MÁR LEJÁRT
 * (–5 nap) – így a demóban azonnal látszik egy „lejárt" emlékeztető.
 */
@Injectable()
export class StubVerificationProvider implements VehicleVerificationProvider {
  verify(input: VehicleVerificationInput): Promise<VehicleVerificationData> {
    if (!input.plate && !input.vin) {
      return Promise.resolve({
        status: 'not_found',
        source: 'stub',
        itpValidUntil: null,
        rcaValidUntil: null,
        vignetteValidUntil: null,
      });
    }
    const now = Date.now();
    return Promise.resolve({
      status: 'ok',
      source: 'stub',
      itpValidUntil: iso(now + 183 * DAY),
      rcaValidUntil: iso(now + 92 * DAY),
      vignetteValidUntil: iso(now - 5 * DAY),
    });
  }
}
