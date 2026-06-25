import { Module } from '@nestjs/common';
import { SupportAccessService } from './support-access.service';
import { SupportAccessController } from './support-access.controller';

/**
 * Support-hozzáférés modul. A PrismaService és az AuditService globális
 * modulokból injektálódik. A SupportAccessService exportált, hogy a controlleren
 * túl máshonnan (pl. takarító feladat) is elérhető legyen.
 */
@Module({
  controllers: [SupportAccessController],
  providers: [SupportAccessService],
  exports: [SupportAccessService],
})
export class SupportAccessModule {}
