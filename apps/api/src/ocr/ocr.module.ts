import { Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OCR_PROVIDER } from './ocr.provider';
import { StubOcrProvider } from './providers/stub-ocr.provider';

/**
 * OCR provider factory. Az OCR_PROVIDER env alapján választ implementációt.
 * Jelenleg csak a `stub` implementált; a `mistral`/`google` Fázis 2.
 */
const ocrProviderFactory: Provider = {
  provide: OCR_PROVIDER,
  inject: [AppConfigService, StubOcrProvider],
  useFactory: (config: AppConfigService, stub: StubOcrProvider) => {
    switch (config.ocrProvider) {
      case 'stub':
        return stub;
      // TODO (Fázis 2): case 'mistral': return new MistralOcrProvider(...);
      // TODO (Fázis 2): case 'google': return new GoogleDocumentAiOcrProvider(...);
      default:
        // Ismeretlen/még nem implementált provider → biztonságos fallback stubra.
        return stub;
    }
  },
};

@Module({
  providers: [StubOcrProvider, ocrProviderFactory],
  exports: [OCR_PROVIDER],
})
export class OcrModule {}
