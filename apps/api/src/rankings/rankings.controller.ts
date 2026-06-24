import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RankingsService } from './rankings.service';

/**
 * Jármű-ranglista API. A REPORTS feature flag mögött (mint az insights/
 * benchmark/major-components). Olvasás minden tagnak.
 */
@Controller('rankings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
@RequireFeature(FeatureKey.REPORTS)
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  /** Ranglista szegmensenként és márka/modellenként. */
  @Get()
  get() {
    return this.rankings.getRankings();
  }
}
