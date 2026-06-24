import { Module } from '@nestjs/common';
import { MajorComponentsService } from './major-components.service';
import { MajorComponentsController } from './major-components.controller';

/**
 * Nagy alkatrész modul: fődarab csere/felújítás események CRUD-ja és a
 * „felújítás-összerakás". A jármű-idővonal és (Fázis D) a tanuló tartósság-
 * felmérés alapja. Az AuditService globális modulból injektálódik.
 */
@Module({
  controllers: [MajorComponentsController],
  providers: [MajorComponentsService],
  exports: [MajorComponentsService],
})
export class MajorComponentsModule {}
