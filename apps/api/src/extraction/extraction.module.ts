import { Logger, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { EXTRACTION_PROVIDER } from './extraction.provider';
import { StubExtractionProvider } from './providers/stub-extraction.provider';
import { GeminiExtractionProvider } from './providers/gemini-extraction.provider';

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

@Module({
  providers: [
    StubExtractionProvider,
    GeminiExtractionProvider,
    extractionProviderFactory,
  ],
  exports: [EXTRACTION_PROVIDER],
})
export class ExtractionModule {}
