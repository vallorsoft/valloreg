import { Injectable } from '@nestjs/common';
import { parseComplianceExtraction } from '@valloreg/shared';
import type { ComplianceExtractionResult } from '@valloreg/shared';
import type {
  ComplianceExtractionContext,
  ComplianceExtractionProvider,
} from '../compliance-extraction.provider';

const DAY = 24 * 60 * 60 * 1000;

/** Determinisztikus stub: ~180 nap múlva lejáró dátumot ad (dev / API nélkül). */
@Injectable()
export class StubComplianceExtractionProvider
  implements ComplianceExtractionProvider
{
  extractCompliance(
    _ocrText: string,
    ctx: ComplianceExtractionContext,
  ): Promise<ComplianceExtractionResult> {
    const validUntil = new Date(Date.now() + 180 * DAY)
      .toISOString()
      .slice(0, 10);
    return Promise.resolve(
      parseComplianceExtraction({
        detectedType: ctx.expectedType ?? null,
        validUntil,
        confidence: 0.8,
        uncertainFields: [],
      }),
    );
  }
}
