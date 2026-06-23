import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsScheduler } from './reports.scheduler';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsScheduler],
  exports: [ReportsService],
})
export class ReportsModule {}
