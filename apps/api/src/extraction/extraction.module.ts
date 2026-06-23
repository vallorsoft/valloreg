import { Logger, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { EXTRACTION_PROVIDER } from './extraction.provider';
import { VEHICLE_EXTRACTION_PROVIDER } from './vehicle-extraction.provider';
import { COMPLIANCE_EXTRACTION_PROVIDER } from './compliance-extraction.provider';
import { StubExtractionProvider } from './providers/stub-extraction.provider';
import { GeminiExtractionProvider } from './providers/gemini-extraction.provider';
import { StubVehicleExtractionProvider } from './providers/stub-vehicle-extraction.provider';
import { GeminiVehicleExtractionProvider } from './providers/gemini-vehicle-extraction.provider';
import { StubComplianceExtractionProvider } from './providers/stub-compliance-extraction.provider';
import { GeminiComplianceExtractionProvider } from './providers/gemini-compliance-extraction.provider';

/**
 * Extraction provider factory. Az EXTRACTION_PROVIDER env alapján választ:
 *  - `stub`   : determinisztikus mintaadat (dev/teszt)
 *  - `gemini` : valódi Google Gemini kinyerés (modell-lánccal)
 *
 * Ha `gemini` van kiválasztva, de nincs GEMINI_API_KEY, biztonságosan a stubra
 * esik vissza (és figyelmeztet) – így a deploy kulcs nélkül sem bukik el.
 */
const extractionProviderFactory: Provider = {
  provide: EXTRACTION_PROVIDER,
  inject: [AppConfigService, StubExtractionProvider, GeminiExtractionProvider],
  useFactory: (
    config: AppConfigService,
    stub: StubExtractionProvider,
    gemini: GeminiExtractionProvider,
  ) => {
    const logger = new Logger('ExtractionProviderFactory');
    switch (config.extractionProvider) {
      case 'gemini':
        if (!config.gemini.apiKey) {
          logger.warn(
            'EXTRACTION_PROVIDER=gemini, de GEMINI_API_KEY hiányzik – stub provider aktív.',
          );
          return stub;
        }
        logger.log('Gemini extraction provider aktív.');
        return gemini;
      case 'stub':
      default:
        return stub;
    }
  },
};

/**
 * Jármű-extraction (forgalmi engedély) provider factory – ugyanaz a logika,
 * mint a számla-extractionnél (gemini → stub fallback kulcs nélkül).
 */
const vehicleExtractionProviderFactory: Provider = {
  provide: VEHICLE_EXTRACTION_PROVIDER,
  inject: [
    AppConfigService,
    StubVehicleExtractionProvider,
    GeminiVehicleExtractionProvider,
  ],
  useFactory: (
    config: AppConfigService,
    stub: StubVehicleExtractionProvider,
    gemini: GeminiVehicleExtractionProvider,
  ) => {
    const logger = new Logger('VehicleExtractionProviderFactory');
    if (config.extractionProvider === 'gemini') {
      if (!config.gemini.apiKey) {
        logger.warn(
          'EXTRACTION_PROVIDER=gemini, de GEMINI_API_KEY hiányzik – stub jármű-extraction aktív.',
        );
        return stub;
      }
      return gemini;
    }
    return stub;
  },
};

/** Megfelelőség-extraction provider factory (gemini → stub fallback). */
const complianceExtractionProviderFactory: Provider = {
  provide: COMPLIANCE_EXTRACTION_PROVIDER,
  inject: [
    AppConfigService,
    StubComplianceExtractionProvider,
    GeminiComplianceExtractionProvider,
  ],
  useFactory: (
    config: AppConfigService,
    stub: StubComplianceExtractionProvider,
    gemini: GeminiComplianceExtractionProvider,
  ) => {
    if (config.extractionProvider === 'gemini' && config.gemini.apiKey) {
      return gemini;
    }
    return stub;
  },
};

@Module({
  providers: [
    StubExtractionProvider,
    GeminiExtractionProvider,
    extractionProviderFactory,
    StubVehicleExtractionProvider,
    GeminiVehicleExtractionProvider,
    vehicleExtractionProviderFactory,
    StubComplianceExtractionProvider,
    GeminiComplianceExtractionProvider,
    complianceExtractionProviderFactory,
  ],
  exports: [
    EXTRACTION_PROVIDER,
    VEHICLE_EXTRACTION_PROVIDER,
    COMPLIANCE_EXTRACTION_PROVIDER,
  ],
})
export class ExtractionModule {}
