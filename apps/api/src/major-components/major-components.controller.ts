import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FeatureKey, TenantRole } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { ActiveTenant, AuthUser } from '../common/types/request-context';
import { MajorComponentsService } from './major-components.service';
import { CreateMajorComponentEventDto } from './dto/create-major-component-event.dto';

const WRITE_ROLES = [
  TenantRole.OWNER,
  TenantRole.FLEET_MANAGER,
  TenantRole.ADMIN,
  TenantRole.ACCOUNTANT,
] as const;

/**
 * Nagy alkatrész események API. A REPORTS feature flag mögött (mint az
 * insights/benchmark). Olvasás minden tagnak; írás a kezelő szerepköröknek.
 */
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
@RequireFeature(FeatureKey.REPORTS)
export class MajorComponentsController {
  constructor(private readonly service: MajorComponentsService) {}

  /** Egy jármű nagy-alkatrész idővonala. */
  @Get('vehicles/:vehicleId/major-components')
  list(@Param('vehicleId') vehicleId: string) {
    return this.service.listForVehicle(vehicleId);
  }

  /** Nagy alkatrész esemény rögzítése (kézzel vagy tételekből összerakva). */
  @Post('vehicles/:vehicleId/major-components')
  @Roles(...WRITE_ROLES)
  create(
    @Param('vehicleId') vehicleId: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMajorComponentEventDto,
  ) {
    return this.service.create(tenant.tenantId, user.userId, vehicleId, dto);
  }

  /** Esemény törlése. */
  @Delete('major-components/:id')
  @Roles(...WRITE_ROLES)
  remove(
    @Param('id') id: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.remove(tenant.tenantId, user.userId, id);
  }
}
