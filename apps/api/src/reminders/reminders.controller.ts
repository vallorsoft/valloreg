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
  Query,
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
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CompleteReminderDto } from './dto/complete-reminder.dto';

/**
 * Emlékeztetők API. A REMINDERS feature flag mögött. Olvasás minden tagnak;
 * írás a kezelő szerepköröknek (OWNER / FLEET_MANAGER / ADMIN), az "elvégezve"
 * jelölést a könyvelő (ACCOUNTANT) is megteheti.
 */
@Controller('reminders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
@RequireFeature(FeatureKey.REMINDERS)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /** Lista – opcionálisan egy járműre szűrve (`?vehicleId=`). */
  @Get()
  list(@Query('vehicleId') vehicleId?: string) {
    return this.reminders.list(vehicleId);
  }

  /** Esedékes (due_soon/overdue) emlékeztetők – dashboard widget. */
  @Get('upcoming')
  upcoming() {
    return this.reminders.upcoming();
  }

  /** Történet-alapú karbantartási javaslatok egy járműre. */
  @Get('suggestions/:vehicleId')
  suggestions(@Param('vehicleId') vehicleId: string) {
    return this.reminders.suggestFromHistory(vehicleId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.reminders.getById(id);
  }

  @Post()
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  create(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReminderDto,
  ) {
    return this.reminders.create(tenant.tenantId, user.userId, dto);
  }

  @Patch(':id')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  update(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.reminders.update(tenant.tenantId, user.userId, id, dto);
  }

  @Post(':id/complete')
  @Roles(
    TenantRole.OWNER,
    TenantRole.FLEET_MANAGER,
    TenantRole.ADMIN,
    TenantRole.ACCOUNTANT,
  )
  complete(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteReminderDto,
  ) {
    return this.reminders.complete(tenant.tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.reminders.remove(tenant.tenantId, user.userId, id);
  }
}
