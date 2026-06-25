import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { ReportsService } from './reports.service';

/**
 * Riport végpontok (olvasás). Minden cégtag elérheti; a tenant-scope a scoped
 * kliensben érvényesül. A `from`/`to` opcionális ISO dátumok (YYYY-MM-DD).
 * A REPORTS feature mögött (a csomag adja); az export külön az EXPORT mögött.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature(FeatureKey.REPORTS)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** Összegző riport: költségek járművenként, kategóriánként, havonta. */
  @Get('summary')
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getSummary(from, to);
  }

  /** Lapos sorok exporthoz (a kliens CSV-t épít belőle). */
  @Get('export')
  @RequireFeature(FeatureKey.EXPORT)
  getExport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getExportRows(from, to);
  }
}
