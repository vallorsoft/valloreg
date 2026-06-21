import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  /** Az aktív cég effektív feature-kulcsai (csomag ∪ override). */
  @Get()
  async getFeatures(): Promise<{ features: string[] }> {
    const features = await this.featureFlags.getEffectiveFeatures();
    return { features };
  }
}
