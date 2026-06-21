import type { ExtractionResult } from '@valloreg/shared';

/**
 * Extraction provider port (interfész). OCR szövegből strukturált,
 * @valloreg/shared `ExtractionResult` szerződést készít.
 * Fázis 2-ben az `anthropic` (Claude) implementáció tölti ki.
 */
export interface ExtractionContext {
  tenantId: string;
  documentId: string;
  /** Opcionális nyelvi hint (hu/ro/en). */
  locale?: string;
}

export interface ExtractionProvider {
  extract(ocrText: string, ctx: ExtractionContext): Promise<ExtractionResult>;
}

/** DI token az aktuális ExtractionProvider implementációhoz. */
export const EXTRACTION_PROVIDER = Symbol('EXTRACTION_PROVIDER');
