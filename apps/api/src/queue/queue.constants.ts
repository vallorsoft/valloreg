/**
 * Queue nevek és job típusok. Egy `documents` queue dolgozza fel a feltöltött
 * dokumentumokat (OCR → extraction → perzisztálás).
 */
export const DOCUMENTS_QUEUE = 'documents';

export const DOCUMENT_JOB = {
  PROCESS: 'process-document',
} as const;

export interface ProcessDocumentJobData {
  tenantId: string;
  documentId: string;
  /** Idempotencia-kulcs alapja: a dokumentum sha256-ja. */
  sha256: string;
}

/** DI token a documents BullMQ Queue-hoz. */
export const DOCUMENTS_QUEUE_TOKEN = Symbol('DOCUMENTS_QUEUE_TOKEN');
