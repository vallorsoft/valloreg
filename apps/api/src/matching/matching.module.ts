import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { InvoicePersistenceService } from './invoice-persistence.service';

/**
 * Felismerő motor modul. A MatchingService a worker (DocumentsProcessor) számára
 * oldja fel a beszállítót és a járművet a feldolgozás során; az
 * InvoicePersistenceService a számla + tételek perzisztálását adja (a worker és
 * az Excel köteges import közösen használja).
 */
@Module({
  providers: [MatchingService, InvoicePersistenceService],
  exports: [MatchingService, InvoicePersistenceService],
})
export class MatchingModule {}
