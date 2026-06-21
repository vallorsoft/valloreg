import { Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OCR_PROVIDER } from './ocr.provider';
import { StubOcrProvider } from './providers/stub-ocr.provider';
import { GeminiOcrProvider } from './providers/gemini-ocr.provider';

const ocrProviderFactory: Provider = {
  provide: OCR_PROVIDER,
  inject: [AppConfigService, StubOcrProvider, GeminiOcrProvider],
  useFactory: (
    config: AppConfigService,
    stub: StubOcrProvider,
    gemini: GeminiOcrProvider,
  ) => {
    switch (config.ocrProvider) {
      case 'gemini':
        return config.gemini.apiKey ? gemini : stub;
      default:
        return stub;
    }
  },
};

@Module({
  providers: [StubOcrProvider, GeminiOcrProvider, ocrProviderFactory],
  exports: [OCR_PROVIDER],
})
export class OcrModule {}
