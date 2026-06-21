import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureGuard } from '../common/guards/feature.guard';

/**
 * Globális feature-flag modul. A FeatureFlagsService és a FeatureGuard bárhol
 * elérhető (a FeatureGuard a service-re támaszkodik).
 */
@Global()
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureGuard],
  exports: [FeatureFlagsService, FeatureGuard],
})
export class FeatureFlagsModule {}
