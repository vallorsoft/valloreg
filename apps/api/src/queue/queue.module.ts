import { Module } from '@nestjs/common';
import { OcrModule } from '../ocr/ocr.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { MatchingModule } from '../matching/matching.module';
import {
  documentsQueueProvider,
  vehicleScansQueueProvider,
} from './queue.providers';
import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsProcessor } from './documents.processor';
import { VehicleScansQueueService } from './vehicle-scans-queue.service';
import { VehicleScanProcessor } from './vehicle-scan.processor';

/**
 * Queue modul:
 *  - `documents` queue: producer (DocumentsQueueService) + worker
 *    (DocumentsProcessor) – számla OCR → extraction → perzisztálás.
 *  - `vehicle-scans` queue: producer (VehicleScansQueueService) + worker
 *    (VehicleScanProcessor) – forgalmi engedély OCR → AI kiolvasás → eredmény.
 *
 * A workerek ugyanebben az app-processzben futnak; mindkettő az OCR és
 * Extraction providereket használja.
 */
@Module({
  imports: [OcrModule, ExtractionModule, MatchingModule],
  providers: [
    documentsQueueProvider,
    DocumentsQueueService,
    DocumentsProcessor,
    vehicleScansQueueProvider,
    VehicleScansQueueService,
    VehicleScanProcessor,
  ],
  exports: [DocumentsQueueService, VehicleScansQueueService],
})
export class QueueModule {}
