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
    const jobId = `doc:${data.tenantId}:${data.sha256}`;
    await this.queue.add(DOCUMENT_JOB.PROCESS, data, { jobId });
    this.logger.log(`Dokumentum feldolgozás sorbavéve (jobId: ${jobId}).`);
  }
}
