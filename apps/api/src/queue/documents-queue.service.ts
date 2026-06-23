import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DOCUMENT_JOB,
  DOCUMENTS_QUEUE_TOKEN,
  ProcessDocumentJobData,
} from './queue.constants';

/**
 * Producer: a dokumentum-feldolgozó job felvétele a queue-ba.
 * Idempotencia: a jobId a dokumentum sha256-jából képződik, így ugyanaz a fájl
 * nem kerül be kétszer (a BullMQ az azonos jobId-t deduplikálja).
 */
@Injectable()
export class DocumentsQueueService {
  private readonly logger = new Logger(DocumentsQueueService.name);

  constructor(
    @Inject(DOCUMENTS_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  async enqueueProcess(data: ProcessDocumentJobData): Promise<void> {
    // A jobId a dokumentum EGYEDI azonosítójából képződik (nem a sha256-ból).
    // Korábban a sha256 volt a kulcs, de a `removeOnComplete` miatt a kész jobok
    // bennmaradnak, így UGYANAZON fájl ismételt feltöltése a BullMQ jobId-
    // deduplikációja miatt SOHA nem került újra sorba → a dokumentum örökre QUEUED
    // maradt. A duplikátum-számlák tartalmi kiszűrése amúgy is a feldolgozóban
    // (supplier+invoiceNumber) történik, nem itt; a fájl-szintű idempotenciát a
    // DocumentsService.upload sha256-ellenőrzése adja.
    const jobId = `doc:${data.tenantId}:${data.documentId}`;
    await this.queue.add(DOCUMENT_JOB.PROCESS, data, { jobId });
    this.logger.log(`Dokumentum feldolgozás sorbavéve (jobId: ${jobId}).`);
  }
}
