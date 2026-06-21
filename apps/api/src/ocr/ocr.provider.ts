/**
 * OCR provider port (interfész). A worker ezen keresztül kéri a nyers szöveget.
 * Fázis 2-ben a `mistral` / `google` implementációk töltik ki.
 */
export interface OcrInput {
  /** A dokumentum tárolási kulcsa (S3). */
  storageKey: string;
  mimeType: string;
  /** Cég-azonosító az izolációhoz/logoláshoz. */
  tenantId: string;
  documentId: string;
}

export interface OcrResult {
  text: string;
  pages: number;
}

export interface OcrProvider {
  recognize(input: OcrInput): Promise<OcrResult>;
}

/** DI token az aktuális OcrProvider implementációhoz. */
export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
