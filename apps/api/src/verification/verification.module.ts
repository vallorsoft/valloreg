import { Logger, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { OcrModule } from '../ocr/ocr.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { VEHICLE_VERIFICATION_PROVIDER } from './verification.provider';
import { StubVerificationProvider } from './providers/stub-verification.provider';
import { RoVerificationProvider } from './providers/ro-verification.provider';
import { VerificationService } from './verification.service';
import { VerificationScheduler } from './verification.scheduler';

/**
 * Verification provider factory: `ro` esetén a RO külső API providert választja
 * (API nélkül az `error` ágra esik, nem ír felül adatot); különben `stub`.
 */
const verificationProviderFactory: Provider = {
  provide: VEHICLE_VERIFICATION_PROVIDER,
  inject: [AppConfigService, StubVerificationProvider, RoVerificationProvider],
  useFactory: (
    config: AppConfigService,
    stub: StubVerificationProvider,
    ro: RoVerificationProvider,
  ) => {
    const logger = new Logger('VerificationProviderFactory');
    if (config.vehicleVerifyProvider === 'ro') {
      logger.log('RO verification provider aktív.');
      return ro;
    }
    return stub;
  },
};

@Module({
  imports: [OcrModule, ExtractionModule],
  providers: [
    StubVerificationProvider,
    RoVerificationProvider,
    verificationProviderFactory,
    VerificationService,
    VerificationScheduler,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
