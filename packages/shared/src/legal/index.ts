// Valloreg – jogi / GDPR dokumentumok megosztott kontraktusa és seed-forrása.
// A tartalom kanonikus nyelve a ROMÁN. A futásidejű tartalom a `legal_documents`
// DB-modellben él; az alábbi tömb a SEED forrása + a típus-kontraktus.

import type { LegalCategoryMeta, LegalDoc } from './types';
import { PUBLIC_DOCS } from './content/public';
import { GDPR_DOCS } from './content/gdpr';
import { SECURITY_DOCS } from './content/security';
import { AI_DOCS } from './content/ai';
import { HR_DOCS } from './content/hr';

export * from './types';
export * from './serialize';
export { COMPANY, companyIdentityItems } from './company';

/** A teljes seed-forrás (publikus + belső dokumentumok). */
export const LEGAL_SEED_DOCS: LegalDoc[] = [
  ...PUBLIC_DOCS,
  ...GDPR_DOCS,
  ...SECURITY_DOCS,
  ...AI_DOCS,
  ...HR_DOCS,
];

export const LEGAL_CATEGORIES: LegalCategoryMeta[] = [
  {
    key: 'public',
    title: 'Documente publice',
    description: 'Confidențialitate, termeni și cookie-uri pentru utilizatori și vizitatori.',
  },
  {
    key: 'gdpr',
    title: 'Conformitate GDPR',
    description: 'Registre, evaluări de impact și proceduri conform GDPR și Legii 190/2018.',
  },
  {
    key: 'security',
    title: 'Securitate și continuitate',
    description: 'Măsuri de securitate, răspuns la incidente, backup și continuitate.',
  },
  {
    key: 'ai',
    title: 'Inteligență artificială (EU AI Act)',
    description: 'Conformitate AI Act, riscuri, supraveghere umană și transparență.',
  },
  {
    key: 'hr',
    title: 'Organizatoric / HR',
    description: 'Confidențialitatea personalului și gestionarea accesului.',
  },
];

/**
 * Mely seed-dokumentumok publikusak ALAPÉRTELMEZÉSBEN (a kötelező publikusak):
 * adatvédelmi tájékoztató, ÁSZF, cookie szabályzat + AI transzparencia. A többi
 * belső marad, amíg a SuperAdmin közzé nem teszi.
 */
export const DEFAULT_PUBLIC_LEGAL_SLUGS: readonly string[] = [
  'confidentialitate',
  'termeni-si-conditii',
  'cookie',
  'transparenta-ai',
];

export function isSeedDocPublicByDefault(doc: LegalDoc): boolean {
  return DEFAULT_PUBLIC_LEGAL_SLUGS.includes(doc.slug);
}
