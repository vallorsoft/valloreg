import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { BillingService } from './billing.service';

/**
 * Előfizetés (billing) végpontok. Olvasás minden cégtagnak; a tenant-scope a
 * scoped kliensben érvényesül.
 */
@Controller('billing')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('overview')
  getOverview() {
    return this.billingService.getOverview();
  }
}
