import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalSeedService } from './legal-seed.service';
import { LegalController } from './legal.controller';
import { LegalAdminController } from './legal-admin.controller';

/**
 * Jogi / GDPR dokumentumok modulja. A PrismaService, AuditService és
 * MailerService globális modulokból érkezik (nincs külön import). A
 * `LegalSeedService` indításkor (prod-biztosan) pótolja a hiányzó dokumentumokat.
 */
@Module({
  controllers: [LegalController, LegalAdminController],
  providers: [LegalService, LegalSeedService],
  exports: [LegalService],
})
export class LegalModule {}
