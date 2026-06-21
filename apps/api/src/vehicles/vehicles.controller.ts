import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  /** Lista – minden tag (VIEWER is). */
  @Get()
  list() {
    return this.vehiclesService.list();
  }

  /** Részletek – minden tag. */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.vehiclesService.getById(id);
  }

  /** Létrehozás – OWNER, FLEET_MANAGER, ADMIN. */
  @Post()
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  create(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(tenant.tenantId, user.userId, dto);
  }

  /** Módosítás – OWNER, FLEET_MANAGER, ADMIN. */
  @Patch(':id')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  update(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(tenant.tenantId, user.userId, id, dto);
  }

  /** Törlés – OWNER, FLEET_MANAGER, ADMIN. */
  @Delete(':id')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.vehiclesService.remove(tenant.tenantId, user.userId, id);
  }
}
