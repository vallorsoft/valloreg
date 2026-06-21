import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
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
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** Az aktív cég adatai (minden tag láthatja). */
  @Get('current')
  getCurrent(@CurrentTenant() tenant: ActiveTenant) {
    return this.tenantsService.getById(tenant.tenantId);
  }

  /** Cég adatok módosítása (OWNER, ADMIN). */
  @Patch('current')
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  update(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(tenant.tenantId, user.userId, dto);
  }
}
