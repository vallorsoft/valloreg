import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature(FeatureKey.DASHBOARD)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getDashboardStats() {
    return this.statsService.getDashboardStats();
  }
}
