import { Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { EXTRACTION_PROVIDER } from './extraction.provider';
import { StubExtractionProvider } from './providers/stub-extraction.provider';

/**
 * Extraction provider factory. Az EXTRACTION_PROVIDER env alapján választ.
 * Jelenleg csak a `stub` implementált; az `anthropic` Fázis 2.
 */
const extractionProviderFactory: Provider = {
  provide: EXTRACTION_PROVIDER,
  inject: [AppConfigService, StubExtractionProvider],
  useFactory: (config: AppConfigService, stub: StubExtractionProvider) => {
    switch (config.extractionProvider) {
      case 'stub':
        return stub;
      // TODO (Fázis 2): case 'anthropic': return new AnthropicExtractionProvider(...);
      default:
        return stub;
    }
  },
};

@Module({
  providers: [StubExtractionProvider, extractionProviderFactory],
  exports: [EXTRACTION_PROVIDER],
})
export class ExtractionModule {}
