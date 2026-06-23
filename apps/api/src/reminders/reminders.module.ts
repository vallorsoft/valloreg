import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersScheduler } from './reminders.scheduler';

/**
 * Emlékeztető modul: CRUD API + történet-alapú javaslatok + napi háttér-ütemező
 * (proaktív karbantartás és lejárat-figyelés). A NotificationsService és a
 * MailerService globális modulokból injektálódik.
 */
@Module({
  controllers: [RemindersController],
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersModule {}
