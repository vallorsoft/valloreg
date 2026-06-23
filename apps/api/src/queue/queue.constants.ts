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

// ── Forgalmi-beolvasás (OCR + AI) aszinkron queue ──────────────────────────

/**
 * A forgalmi engedély beolvasását egy külön `vehicle-scans` queue dolgozza fel
 * (staging fájlok → OCR → AI kiolvasás → VehicleScan eredmény). Így a hosszú
 * OCR+AI nem a HTTP-kérés idejét terheli.
 */
export const VEHICLE_SCANS_QUEUE = 'vehicle-scans';

export const VEHICLE_SCAN_JOB = {
  PROCESS: 'process-vehicle-scan',
} as const;

export interface ProcessVehicleScanJobData {
  tenantId: string;
  scanId: string;
  /** Nyelvi hint az AI-nak (hu/ro/en). */
  locale?: string;
}

/** DI token a vehicle-scans BullMQ Queue-hoz. */
export const VEHICLE_SCANS_QUEUE_TOKEN = Symbol('VEHICLE_SCANS_QUEUE_TOKEN');
