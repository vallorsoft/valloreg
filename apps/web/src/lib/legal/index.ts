// Valloreg – registrul central al documentelor juridice / GDPR.
// Toate documentele sunt în limba română (limba canonică), grupate pe categorii.

import type { LegalCategory, LegalCategoryMeta, LegalDoc } from './types';
import { PUBLIC_DOCS } from './content/public';
import { GDPR_DOCS } from './content/gdpr';
import { SECURITY_DOCS } from './content/security';
import { AI_DOCS } from './content/ai';
import { HR_DOCS } from './content/hr';

export type { LegalDoc, LegalBlock, LegalCategory } from './types';
export { COMPANY } from './company';

export const LEGAL_DOCS: LegalDoc[] = [
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

/** Returnează documentul după slug (sau undefined). */
export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

/** Documentele dintr-o categorie, în ordinea declarată. */
export function getDocsByCategory(category: LegalCategory): LegalDoc[] {
  return LEGAL_DOCS.filter((d) => d.category === category);
}

/** Toate slug-urile (pentru generateStaticParams). */
export function getAllLegalSlugs(): string[] {
  return LEGAL_DOCS.map((d) => d.slug);
}
