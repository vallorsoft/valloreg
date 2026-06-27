// Szerver-oldali (publikus) jogi API-kliens. A jogi tartalom MOST a DB-ben él,
// a NestJS API szolgálja ki; ez a modul a publikus (auth nélküli) végpontokat
// hívja a landing „Legal" oldalaihoz. Nem 'use client' – server componentből hív.
//
// SEED-FALLBACK: ha az API elérhetetlen (build-time prerender, backend nélküli
// E2E, vagy átmeneti kiesés), a `@valloreg/shared` SEED-tartalmából rendereljük a
// kötelező-publikus dokumentumokat – így az oldalak backend nélkül is működnek.

import {
  COMPANY_DEFAULT_CONTEXT,
  LEGAL_CATEGORIES,
  LEGAL_SEED_DOCS,
  applyLegalTokens,
  applyLegalTokensToRecord,
  isSeedDocPublicByDefault,
} from '@valloreg/shared';
import type { LegalCategory, LegalDoc, LegalDocListItem, LegalDocRecord } from '@valloreg/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface PublicLegalCategory {
  key: LegalCategory;
  title: string;
  description: string;
  docs: LegalDocListItem[];
}

export interface PublicLegalHub {
  categories: PublicLegalCategory[];
}

// ── Seed-fallback segédek ───────────────────────────────────────────────────

// A fallback nincs DB/billing-beállítás birtokában, ezért a tokeneket a
// COMPANY-default kontextusból helyettesíti (a beégetett alap cégadatok).
const sub = (t: string) => applyLegalTokens(t, COMPANY_DEFAULT_CONTEXT);

function seedListItem(doc: LegalDoc): LegalDocListItem {
  return {
    slug: doc.slug,
    category: doc.category,
    title: sub(doc.title),
    subtitle: doc.subtitle != null ? sub(doc.subtitle) : null,
    summary: sub(doc.summary),
    updated: doc.updated,
    isPublic: true,
  };
}

function seedRecord(doc: LegalDoc): LegalDocRecord {
  return applyLegalTokensToRecord(
    {
      slug: doc.slug,
      category: doc.category,
      title: doc.title,
      subtitle: doc.subtitle ?? null,
      summary: doc.summary,
      updated: doc.updated,
      blocks: doc.blocks,
      isPublic: true,
    },
    COMPANY_DEFAULT_CONTEXT,
  );
}

function seedHub(): PublicLegalHub {
  const publicDocs = LEGAL_SEED_DOCS.filter(isSeedDocPublicByDefault);
  return {
    categories: LEGAL_CATEGORIES.map((cat) => ({
      ...cat,
      docs: publicDocs.filter((d) => d.category === cat.key).map(seedListItem),
    })).filter((cat) => cat.docs.length > 0),
  };
}

function seedDoc(slug: string): LegalDocRecord | null {
  const doc = LEGAL_SEED_DOCS.find((d) => d.slug === slug && isSeedDocPublicByDefault(d));
  return doc ? seedRecord(doc) : null;
}

// ── Publikus lekérdezések (API → seed-fallback) ─────────────────────────────

/** A publikus jogi dokumentumok kategóriánként (a „Legal" hub oldalhoz). */
export async function fetchPublicLegalHub(): Promise<PublicLegalHub> {
  try {
    const res = await fetch(`${API_BASE_URL}/legal`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      return (await res.json()) as PublicLegalHub;
    }
  } catch {
    // hálózati hiba / nincs backend → seed-fallback
  }
  return seedHub();
}

/** Egy publikus jogi dokumentum, vagy null ha nem létezik / nem publikus. */
export async function fetchPublicLegalDoc(slug: string): Promise<LegalDocRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/legal/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      return (await res.json()) as LegalDocRecord;
    }
    // A dokumentum létezik, de nem publikus (vagy nincs) → nincs fallback.
    if (res.status === 404) {
      return null;
    }
  } catch {
    // hálózati hiba / nincs backend → seed-fallback
  }
  return seedDoc(slug);
}
