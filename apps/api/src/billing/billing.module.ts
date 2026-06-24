import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingSettingsService } from './billing-settings.service';
import { BillingController } from './billing.controller';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingSettingsService],
  exports: [BillingService, BillingSettingsService],
})
export class BillingModule {}
