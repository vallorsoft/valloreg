import { Logger, Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { RECALL_PROVIDER } from './recall.provider';
import { StubRecallProvider } from './providers/stub-recall.provider';
import { ExternalRecallProvider } from './providers/external-recall.provider';
import { BenchmarkService } from './benchmark.service';
import { BenchmarkController } from './benchmark.controller';
import { BenchmarkScheduler } from './benchmark.scheduler';

/**
 * Recall provider factory: `external` esetén a konfigurált INGYENES feed
 * providert választja (URL nélkül üresre esik); különben a beépített, kurált
 * `stub`. Fizetős forrás itt SZÁNDÉKOSAN nincs bekötve.
 */
const recallProviderFactory: Provider = {
  provide: RECALL_PROVIDER,
  inject: [AppConfigService, StubRecallProvider, ExternalRecallProvider],
  useFactory: (
    config: AppConfigService,
    stub: StubRecallProvider,
    external: ExternalRecallProvider,
  ) => {
    const logger = new Logger('RecallProviderFactory');
    if (config.recallProvider === 'external') {
      logger.log('External recall provider aktív.');
      return external;
    }
    return stub;
  },
};

@Module({
  providers: [
    StubRecallProvider,
    ExternalRecallProvider,
    recallProviderFactory,
    BenchmarkService,
    BenchmarkScheduler,
  ],
  controllers: [BenchmarkController],
  exports: [BenchmarkService],
})
export class BenchmarkModule {}
