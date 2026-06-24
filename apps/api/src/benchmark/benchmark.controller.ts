import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { BenchmarkService } from './benchmark.service';

/**
 * „Európai trendek" végpontok: anonimizált flotta-benchmark összevetés és
 * jármű-visszahívások. A ANALYTICS feature mögött (ugyanaz a szint, mint az
 * insights/riportok). Tenant-scope a scoped kliensben.
 */
@Controller('benchmark')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureGuard)
@RequireFeature(FeatureKey.ANALYTICS)
export class BenchmarkController {
  constructor(private readonly benchmark: BenchmarkService) {}

  /** A cég szegmens-mediánjai a piaci (anonimizált) benchmarkhoz viszonyítva. */
  @Get()
  comparison() {
    return this.benchmark.getComparison();
  }

  /** A flotta járműveire vonatkozó visszahívások (ingyenes forrásból). */
  @Get('recalls')
  recalls() {
    return this.benchmark.getRecalls();
  }
}
