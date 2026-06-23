import type { ComplianceExtractionResult, ComplianceType } from '@valloreg/shared';

/**
 * Megfelelőségi dokumentum (ITP/RCA/rovinietă) extraction port: OCR szövegből a
 * lejárati dátumot adja vissza (@valloreg/shared ComplianceExtractionResult).
 */
export interface ComplianceExtractionContext {
  tenantId: string;
  /** A felhasználó által választott típus (segíti a kiolvasást). */
  expectedType?: ComplianceType;
  locale?: string;
}

export interface ComplianceExtractionProvider {
  extractCompliance(
    ocrText: string,
    ctx: ComplianceExtractionContext,
  ): Promise<ComplianceExtractionResult>;
}

export const COMPLIANCE_EXTRACTION_PROVIDER = Symbol(
  'COMPLIANCE_EXTRACTION_PROVIDER',
);
