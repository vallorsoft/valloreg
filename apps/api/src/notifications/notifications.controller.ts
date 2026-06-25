import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  ActiveTenant,
  AuthUser,
} from '../common/types/request-context';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** A publikus VAPID kulcs a feliratkozáshoz (bejelentkezett felhasználó). */
  @Get('vapid-key')
  @UseGuards(JwtAuthGuard)
  vapidKey() {
    return this.notifications.getPublicKey();
  }

  /** Feliratkozás (a böngésző PushManager subscription-jét küldi). */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard, TenantGuard)
  subscribe(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: ActiveTenant,
    @Body() dto: SubscribePushDto,
  ) {
    return this.notifications.subscribe(user.userId, tenant.tenantId, dto);
  }

  /** Leiratkozás endpoint alapján (csak a saját feliratkozás). */
  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribePushDto) {
    return this.notifications.unsubscribe(user.userId, dto.endpoint);
  }
}
