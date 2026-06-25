import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { SupportAccessService } from './support-access.service';
import { GrantSupportAccessDto } from './dto/grant-support-access.dto';

/**
 * Ideiglenes, auditált support-hozzáférés kezelése a cégen belül. Csak OWNER és
 * ADMIN kezelhet grant-eket (a RolesGuard kényszeríti). A grant olvasás-only és
 * idő-korlátos – a tényleges hozzáférés-érvényesítés a TenantGuard-ban történik.
 */
@Controller('tenants/current/support-access')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SupportAccessController {
  constructor(private readonly supportAccess: SupportAccessService) {}

  /** Új support-hozzáférés megadása (OWNER, ADMIN). */
  @Post()
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  grant(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: GrantSupportAccessDto,
  ) {
    return this.supportAccess.grant(tenant.tenantId, user.userId, dto);
  }

  /** A cég support-hozzáféréseinek listája (OWNER, ADMIN). */
  @Get()
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  list(@CurrentTenant() tenant: ActiveTenant) {
    return this.supportAccess.list(tenant.tenantId);
  }

  /** Support-hozzáférés visszavonása (OWNER, ADMIN). */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  revoke(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.supportAccess.revoke(tenant.tenantId, id, user.userId);
  }
}
