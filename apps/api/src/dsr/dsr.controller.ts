import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantRole } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import type {
  ActiveTenant,
  AuthenticatedRequest,
  AuthUser,
} from '../common/types/request-context';
import { DsrService } from './dsr.service';
import { DeleteConfirmDto } from './dto/delete-confirm.dto';

@Controller('dsr')
export class DsrController {
  constructor(private readonly dsr: DsrService) {}

  /**
   * Adat-export (GDPR art. 15 & 20) – a felhasználó + az aktív cég adatai JSON-ként.
   * Csak OWNER/ADMIN (a teljes céges adatállomány érzékeny).
   */
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  @Post('export')
  @HttpCode(HttpStatus.OK)
  async export(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: ActiveTenant,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.dsr.exportData(
      user.userId,
      tenant.tenantId,
      user.email,
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="valloreg-export-${Date.now()}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  /** Saját fiók törlése (GDPR art. 17) – jelszó-megerősítéssel. */
  @UseGuards(JwtAuthGuard)
  @Post('account/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteConfirmDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.dsr.deleteAccount(user.userId, dto.password, req.ip);
  }

  /** Cég és minden adatának törlése (GDPR art. 17) – csak OWNER, jelszóval. */
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(TenantRole.OWNER)
  @Post('tenant/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTenant(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: ActiveTenant,
    @Body() dto: DeleteConfirmDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.dsr.deleteTenant(
      tenant.tenantId,
      user.userId,
      dto.password,
      req.ip,
    );
  }
}
