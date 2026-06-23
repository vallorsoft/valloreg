import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';

/**
 * Insight modul: költség-anomália detektálás a meglévő szerviz/számla adatból.
 */
@Module({
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
