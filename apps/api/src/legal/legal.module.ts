import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { LegalAdminController } from './legal-admin.controller';

/**
 * Jogi / GDPR dokumentumok modulja. A PrismaService, AuditService és
 * MailerService globális modulokból érkezik (nincs külön import).
 */
@Module({
  controllers: [LegalController, LegalAdminController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
