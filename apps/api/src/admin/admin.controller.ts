import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/request-context';
import { AdminService } from './admin.service';
import { SetSubscriptionDto } from './dto/set-subscription.dto';
import { SetFeatureOverrideDto } from './dto/set-feature-override.dto';
import { SetExtraStorageDto } from './dto/set-extra-storage.dto';
import { SetBillingSettingsDto } from './dto/set-billing-settings.dto';
import { TestEmailDto } from './dto/test-email.dto';

/**
 * Super Admin (platform) végpontok. Minden végpont `isPlatformAdmin` jogot
 * igényel; nincs tenant kontextus (a SYSTEM kliens dolgozik cégek felett).
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  /** Platform-szintű számla-/utalási adatok (csak Super Admin). */
  @Get('billing-settings')
  getBillingSettings() {
    return this.adminService.getBillingSettings();
  }

  @Put('billing-settings')
  setBillingSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetBillingSettingsDto,
  ) {
    return this.adminService.setBillingSettings(user.userId, dto);
  }

  /** Teszt-email küldése a Brevo-konfiguráció ellenőrzésére. */
  @Post('test-email')
  sendTestEmail(@CurrentUser() user: AuthUser, @Body() dto: TestEmailDto) {
    return this.adminService.sendTestEmail(user.userId, dto.to);
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Put('tenants/:id/subscription')
  setSubscription(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetSubscriptionDto,
  ) {
    return this.adminService.setSubscription(user.userId, id, dto);
  }

  @Put('tenants/:id/extra-storage')
  setExtraStorage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetExtraStorageDto,
  ) {
    return this.adminService.setExtraStorage(user.userId, id, dto.gb);
  }

  @Put('tenants/:id/features/:key')
  setFeatureOverride(
    @Param('id') id: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetFeatureOverrideDto,
  ) {
    return this.adminService.setFeatureOverride(user.userId, id, key, dto);
  }

  @Delete('tenants/:id/features/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFeatureOverride(
    @Param('id') id: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.adminService.removeFeatureOverride(user.userId, id, key);
  }
}
