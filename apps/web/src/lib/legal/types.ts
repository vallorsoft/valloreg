// Valloreg – jogi / GDPR dokumentum-tár típusai.
//
// A jogi tartalom KANONIKUS nyelve a ROMÁN (a román jog + a társaság székhelye
// miatt). A dokumentumok strukturált blokkokból állnak, amelyeket a
// `LegalDocView` komponens renderel – így nincs szükség külső Markdown-függőségre,
// és a tartalom típusbiztosan, verziókövethetően él a repóban.

export type LegalCategory = 'public' | 'gdpr' | 'security' | 'ai' | 'hr';

/** Egy dokumentum tartalmi blokkja. */
export type LegalBlock =
  // Alcím (h2).
  | { k: 'h'; t: string }
  // Bekezdés.
  | { k: 'p'; t: string }
  // Felsorolás (pontok).
  | { k: 'ul'; items: string[] }
  // Számozott lépéssor.
  | { k: 'ol'; items: string[] }
  // Táblázat (fejléc + sorok).
  | { k: 'table'; head: string[]; rows: string[][] }
  // Kiemelt „jogi felülvizsgálat szükséges" / figyelmeztető doboz.
  | { k: 'note'; t: string };

export interface LegalDoc {
  /** URL-slug: /legal/<slug> */
  slug: string;
  category: LegalCategory;
  /** A dokumentum címe (RO). */
  title: string;
  /** Rövid alcím / hatókör (RO). */
  subtitle?: string;
  /** Utolsó frissítés emberi formátumban (pl. „1 iunie 2025"). */
  updated: string;
  /** Rövid összefoglaló a tár-listához és a meta description-höz. */
  summary: string;
  /** A tartalmi blokkok. */
  blocks: LegalBlock[];
  /**
   * Ha igaz, a dokumentum tetején megjelenik a kötelező jogi-felülvizsgálat
   * banner. (A GDPR/AI/biztonsági dokumentumoknál alapból igaz.)
   */
  reviewRequired?: boolean;
}

export interface LegalCategoryMeta {
  key: LegalCategory;
  title: string;
  description: string;
}
