import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { CleanupScheduler } from './cleanup.scheduler';

/**
 * Retenciós takarító modul: napi háttér-ütemező, amely a tárolás-korlátozási
 * elv (GDPR art. 5(1)(e)) szerint purgálja a retenciós ablakon túli adatokat
 * (audit naplók, visszavont/lejárt tokenek, beragadt scan staging).
 * A PrismaService és az AppConfigService globális modulokból injektálódik.
 */
@Module({
  providers: [CleanupService, CleanupScheduler],
  exports: [CleanupService],
})
export class CleanupModule {}
