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
import { Public } from '../common/decorators/public.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  ActiveTenant,
  AuthUser,
} from '../common/types/request-context';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Az aktív cég tagjai. */
  @Get('members')
  @UseGuards(JwtAuthGuard, TenantGuard)
  listMembers(@CurrentTenant() tenant: ActiveTenant) {
    return this.usersService.listMembers(tenant.tenantId);
  }

  /** Meghívó küldése (OWNER, ADMIN). */
  @Post('invite')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  invite(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.invite(tenant.tenantId, user.userId, dto);
  }

  /**
   * Meghívó elfogadása. Publikus (a meghívott még nem tag) – a token azonosít.
   */
  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  /** Tag szerepkörének módosítása (OWNER, ADMIN). */
  @Patch('members/:membershipId/role')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  changeRole(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.usersService.changeMemberRole(
      tenant.tenantId,
      user.userId,
      membershipId,
      dto.role,
    );
  }

  /** Tag eltávolítása (OWNER, ADMIN). */
  @Delete('members/:membershipId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(TenantRole.OWNER, TenantRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('membershipId') membershipId: string,
  ): Promise<void> {
    await this.usersService.removeMember(
      tenant.tenantId,
      user.userId,
      membershipId,
    );
  }
}
