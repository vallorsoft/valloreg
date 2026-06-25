import { Module } from '@nestjs/common';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionScheduler } from './data-retention.scheduler';

/**
 * Adat-megőrzési modul: napi automatikus takarítás (BullMQ ismétlődő job).
 * A PrismaService és AppConfigService globális modulokból érhető el.
 */
@Module({
  providers: [DataRetentionService, DataRetentionScheduler],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
