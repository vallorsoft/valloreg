import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';

/**
 * Felismerő motor modul. A MatchingService a worker (DocumentsProcessor) számára
 * oldja fel a beszállítót és a járművet a feldolgozás során.
 */
@Module({
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
