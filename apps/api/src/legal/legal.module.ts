import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { LegalService } from './legal.service';
import { LegalSeedService } from './legal-seed.service';
import { LegalController } from './legal.controller';
import { LegalAdminController } from './legal-admin.controller';

/**
 * Jogi / GDPR dokumentumok modulja. A PrismaService, AuditService és
 * MailerService globális modulokból érkezik. A BillingModule adja a
 * BillingSettingsService-t (a {{company.*}}/{{bank.*}} token-behelyettesítéshez).
 * A `LegalSeedService` indításkor (prod-biztosan) pótolja a hiányzó dokumentumokat.
 */
@Module({
  imports: [BillingModule],
  controllers: [LegalController, LegalAdminController],
  providers: [LegalService, LegalSeedService],
  exports: [LegalService],
})
export class LegalModule {}
