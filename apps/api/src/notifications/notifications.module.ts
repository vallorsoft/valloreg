import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * Globális értesítés-modul. A NotificationsService bárhol injektálható
 * (pl. a feldolgozó worker push-t küld a dokumentum elkészültekor).
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
