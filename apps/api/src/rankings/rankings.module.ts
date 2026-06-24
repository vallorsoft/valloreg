import { Module } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { SupplierQualityService } from './supplier-quality.service';
import { RankingsController } from './rankings.controller';
import { MajorComponentsModule } from '../major-components/major-components.module';

/**
 * Ranglista modul: jármű-rangsor szegmensenként és márka/modellenként,
 * jelvényekkel és „cserére érdemes" jelzéssel. A DurabilityService-t a
 * MajorComponentsModule-ból injektálja (esedékes nagy részek számához).
 */
@Module({
  imports: [MajorComponentsModule],
  controllers: [RankingsController],
  providers: [RankingsService, SupplierQualityService],
})
export class RankingsModule {}
