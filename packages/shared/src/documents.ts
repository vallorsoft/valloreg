/** Dokumentum-feltöltés szabályai (a spec szerint: PDF, JPG, JPEG, PNG). */

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'] as const;

/** Maximális fájlméret (bytes). 25 MB. */
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

export function isAllowedDocumentMimeType(mime: string): mime is AllowedDocumentMimeType {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

/** Dokumentum feldolgozási állapotai (a feltöltéstől a jóváhagyásig). */
export const DocumentStatus = {
  UPLOADED: 'UPLOADED',
  QUEUED: 'QUEUED',
  OCR_RUNNING: 'OCR_RUNNING',
  EXTRACTING: 'EXTRACTING',
  /** AI kész, de a confidence alacsony → ellenőrzés kell. */
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  /** AI kész és magabiztos. */
  AUTO_OK: 'AUTO_OK',
  /** Felhasználó jóváhagyta. */
  CONFIRMED: 'CONFIRMED',
  /**
   * Az AI felismerte, hogy a dokumentum NEM számla (pl. forgalmi engedély,
   * megfelelőségi igazolás, egyéb). Nem készül belőle számla; a `docType`
   * jelzi a felismert típust.
   */
  NOT_INVOICE: 'NOT_INVOICE',
  /**
   * Lehetséges duplikátum: azonos beszállító + számlaszám már létezik. A
   * felhasználónak fel kell oldania (felülírás) – megtartani NEM lehet.
   */
  DUPLICATE: 'DUPLICATE',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
