// Valloreg – jogi / GDPR dokumentum-tár típusai és validáció.
//
// A jogi tartalom KANONIKUS nyelve a ROMÁN (a román jog + a társaság székhelye
// miatt). A dokumentumok strukturált blokkokból állnak, amelyeket a
// `LegalDocView` komponens renderel – nincs szükség külső Markdown-függőségre.
//
// A tartalom MOST a `legal_documents` DB-modellben él (SuperAdmin szerkeszti);
// az itt definiált `LegalDoc`-tömb a **seed forrása** és a típus-kontraktus.

import { z } from 'zod';

export type LegalCategory = 'public' | 'gdpr' | 'security' | 'ai' | 'hr';

export const LEGAL_CATEGORY_KEYS = ['public', 'gdpr', 'security', 'ai', 'hr'] as const;

/** Egy tartalmi blokk zod-sémája (a SuperAdmin szerkesztő validálásához). */
export const legalBlockSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('h'), t: z.string() }),
  z.object({ k: z.literal('p'), t: z.string() }),
  z.object({ k: z.literal('ul'), items: z.array(z.string()) }),
  z.object({ k: z.literal('ol'), items: z.array(z.string()) }),
  z.object({
    k: z.literal('table'),
    head: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  z.object({ k: z.literal('note'), t: z.string() }),
]);

export const legalBlocksSchema = z.array(legalBlockSchema);

/** Egy dokumentum tartalmi blokkja (h / p / ul / ol / table / note). */
export type LegalBlock = z.infer<typeof legalBlockSchema>;

/** A SuperAdmin által szerkeszthető tartalom (PUT body). */
export const legalDocContentSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullish(),
  summary: z.string().min(1),
  updated: z.string().min(1),
  blocks: legalBlocksSchema,
});

export type LegalDocContent = z.infer<typeof legalDocContentSchema>;

/** A seed forrásdokumentum (a `content/*.ts` ilyeneket exportál). */
export interface LegalDoc {
  /** URL-slug: /legal/<slug> */
  slug: string;
  category: LegalCategory;
  /** A dokumentum címe (RO). */
  title: string;
  /** Rövid alcím / hatókör (RO). */
  subtitle?: string;
  /** Utolsó frissítés emberi formátumban (pl. „25 iunie 2026"). */
  updated: string;
  /** Rövid összefoglaló a tár-listához és a meta description-höz. */
  summary: string;
  /** A tartalmi blokkok. */
  blocks: LegalBlock[];
  /** Megjelenik-e a kötelező jogi-felülvizsgálat banner. */
  reviewRequired?: boolean;
}

/** Egy DB-beli jogi dokumentum (API kimenet – a `legal_documents` rekord). */
export interface LegalDocRecord {
  slug: string;
  category: LegalCategory;
  title: string;
  subtitle?: string | null;
  summary: string;
  /** Emberi „utolsó frissítés" címke. */
  updated: string;
  blocks: LegalBlock[];
  /** Publikus-e a landing/website-on. */
  isPublic: boolean;
  /** ISO időbélyeg (utolsó módosítás). */
  updatedAt?: string;
}

/** Lista-elem (a hub és a SuperAdmin lista – blokkok nélkül). */
export interface LegalDocListItem {
  slug: string;
  category: LegalCategory;
  title: string;
  subtitle?: string | null;
  summary: string;
  updated: string;
  isPublic: boolean;
}

export interface LegalCategoryMeta {
  key: LegalCategory;
  title: string;
  description: string;
}

/** Letöltési formátumok (SuperAdmin letöltés + cégnek küldött csatolmány). */
export const LEGAL_DOWNLOAD_FORMATS = ['md', 'json', 'pdf'] as const;
export type LegalDownloadFormat = (typeof LEGAL_DOWNLOAD_FORMATS)[number];
