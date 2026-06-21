import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantRole } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type { ActiveTenant } from '../common/types/request-context';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Audit lista – ADMIN és OWNER láthatja. */
  @Get()
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  list(
    @CurrentTenant() tenant: ActiveTenant,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const takeNum = take ? parseInt(take, 10) : 100;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    return this.auditService.listForTenant(
      tenant.tenantId,
      Number.isNaN(takeNum) ? 100 : takeNum,
      Number.isNaN(skipNum) ? 0 : skipNum,
    );
  }
}
