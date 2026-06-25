import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantRole } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  ActiveTenant,
  AuthUser,
} from '../common/types/request-context';
import { BillingService } from './billing.service';
import { RequestSubscriptionDto } from './dto/request-subscription.dto';
import { RequestStorageAddonDto } from './dto/request-storage-addon.dto';

/**
 * Előfizetés (billing) végpontok. Az áttekintés minden cégtagnak; az utalásos
 * igénylés OWNER/ADMIN jog. A tenant-scope a scoped kliensben érvényesül.
 */
@Controller('billing')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('overview')
  getOverview() {
    return this.billingService.getOverview();
  }

  /** Utalásos előfizetés igénylése – e-mail a kliensnek + értesítés a fejlesztőnek. */
  @Post('request-subscription')
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  requestSubscription(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestSubscriptionDto,
  ) {
    return this.billingService.requestSubscription(
      tenant.tenantId,
      user.userId,
      dto,
    );
  }

  /** Utalásos extra-tárhely igénylése (+5 / +10 / +25 GB). */
  @Post('request-storage-addon')
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  requestStorageAddon(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestStorageAddonDto,
  ) {
    return this.billingService.requestStorageAddon(
      tenant.tenantId,
      user.userId,
      dto,
    );
  }
}
