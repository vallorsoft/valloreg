import { Module } from '@nestjs/common';
import { DsrController } from './dsr.controller';
import { DsrService } from './dsr.service';

/**
 * GDPR adatalany-jogok (DSR) modul: export + fiók/cég törlés.
 * A PrismaService, StorageService és AuditService globális modulokból jön.
 */
@Module({
  controllers: [DsrController],
  providers: [DsrService],
})
export class DsrModule {}
