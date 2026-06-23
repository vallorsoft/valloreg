import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { InsightsService } from './insights.service';

/**
 * Insight végpontok: költség-anomáliák. A REPORTS feature mögött (ugyanaz a
 * csomag-szint, mint a riportok). Olvasás minden cégtagnak; tenant-scope a
 * scoped kliensben.
 */
@Controller('insights')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature(FeatureKey.REPORTS)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  /** Az összes észlelt anomália (súlyosság szerint rendezve). */
  @Get('anomalies')
  anomalies() {
    return this.insights.getAnomalies();
  }

  /** Összesítő (darabszám típus és súlyosság szerint) – dashboard widget. */
  @Get('anomalies/summary')
  summary() {
    return this.insights.getSummary();
  }

  /** Prediktív TCO / csere-javaslat járművenként. */
  @Get('tco')
  tco() {
    return this.insights.getFleetTco();
  }
}
