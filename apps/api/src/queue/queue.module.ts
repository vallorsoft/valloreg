import { Module } from '@nestjs/common';
import { OcrModule } from '../ocr/ocr.module';
import { ExtractionModule } from '../extraction/extraction.module';
import { documentsQueueProvider } from './queue.providers';
import { DocumentsQueueService } from './documents-queue.service';
import { DocumentsProcessor } from './documents.processor';

/**
 * Queue modul: a `documents` BullMQ producer (DocumentsQueueService) és a
 * worker (DocumentsProcessor). A worker az OCR és Extraction providereket
 * használja a feldolgozáshoz.
 *
 * Megjegyzés: a worker ugyanebben az app-processzben fut. Külön processz-módú
 * (horizontálisan skálázható) worker indítás egy dedikált bootstrap belépési
 * ponttal Fázis 2/üzemeltetés feladata.
 */
@Module({
  imports: [OcrModule, ExtractionModule],
  providers: [
    documentsQueueProvider,
    DocumentsQueueService,
    DocumentsProcessor,
  ],
  exports: [DocumentsQueueService],
})
export class QueueModule {}
