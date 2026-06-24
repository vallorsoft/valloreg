import { Module } from '@nestjs/common';
import { MajorComponentsService } from './major-components.service';
import { DurabilityService } from './durability.service';
import { MajorComponentsController } from './major-components.controller';

/**
 * Nagy alkatrész modul: fődarab csere/felújítás események CRUD-ja, a
 * „felújítás-összerakás", és a tanuló TARTÓSSÁG-felmérés / előrejelzés
 * (DurabilityService). Az AuditService globális modulból injektálódik.
 */
@Module({
  controllers: [MajorComponentsController],
  providers: [MajorComponentsService, DurabilityService],
  exports: [MajorComponentsService, DurabilityService],
})
export class MajorComponentsModule {}
