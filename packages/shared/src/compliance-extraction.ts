import { z } from 'zod';
import { UncertainFieldSchema } from './extraction';

/**
 * Megfelelőségi dokumentum (RO) kiolvasásának szerződése: a lejárati dátum
 * (valid until) az ITP / RCA / rovinietă igazolásból. A dokumentum-alapú
 * (API nélküli) lekérés kimenete.
 */
export const ComplianceType = {
  ITP: 'itp', // műszaki
  RCA: 'rca', // kötelező biztosítás
  VIGNETTE: 'vignette', // autópálya-matrica (rovinietă)
} as const;

export type ComplianceType =
  (typeof ComplianceType)[keyof typeof ComplianceType];

export const ALL_COMPLIANCE_TYPES: readonly ComplianceType[] =
  Object.values(ComplianceType);

export const ComplianceExtractionResultSchema = z.object({
  /** A felismert dokumentumtípus (kereszt-ellenőrzéshez), ha kivehető. */
  detectedType: z.enum(['itp', 'rca', 'vignette']).nullable().default(null),
  /** Érvényesség vége ISO dátumként (YYYY-MM-DD), ha kivehető. */
  validUntil: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  uncertainFields: z.array(UncertainFieldSchema).default([]),
});

export type ComplianceExtractionResult = z.infer<
  typeof ComplianceExtractionResultSchema
>;

export function parseComplianceExtraction(
  input: unknown,
): ComplianceExtractionResult {
  return ComplianceExtractionResultSchema.parse(input);
}
