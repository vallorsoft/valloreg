// Token-helyettesítés a jogi dokumentumokban: a cég-/számlaadatok EGY forrásból
// (a SuperAdmin billing beállításaiból) töltődnek a dokumentumokba. A tartalom
// `{{company.*}}` / `{{bank.*}}` tokeneket tartalmaz, amelyeket kiszolgáláskor
// (API) és a web seed-fallbackjében az aktuális értékekre cserélünk – így ha a
// SuperAdmin módosítja az adatot, a dokumentumban (mindenhol) is megváltozik.

import { COMPANY } from './company';
import type { LegalBlock, LegalDocRecord } from './types';

/** A behelyettesíthető cég-/számlaadatok (a billing beállításokból). */
export interface LegalCompanyContext {
  name: string;
  taxNumber: string;
  regCom: string;
  euid: string;
  address: string;
  phone: string;
  email: string;
  beneficiary: string;
  iban: string;
  bankName: string;
  swift: string;
}

const TOKEN_MAP: Record<string, keyof LegalCompanyContext> = {
  'company.name': 'name',
  'company.taxNumber': 'taxNumber',
  'company.regCom': 'regCom',
  'company.euid': 'euid',
  'company.address': 'address',
  'company.phone': 'phone',
  'company.email': 'email',
  'bank.beneficiary': 'beneficiary',
  'bank.iban': 'iban',
  'bank.bankName': 'bankName',
  'bank.swift': 'swift',
};

const TOKEN_RE = /\{\{\s*([a-zA-Z.]+)\s*\}\}/g;

/** Alapértelmezett kontextus a hardcode-olt COMPANY-ból (web-fallback / üres mező). */
export const COMPANY_DEFAULT_CONTEXT: LegalCompanyContext = {
  name: COMPANY.legalName,
  taxNumber: COMPANY.cui,
  regCom: COMPANY.regCom,
  euid: COMPANY.euid,
  address: COMPANY.address,
  phone: COMPANY.phone,
  email: COMPANY.email,
  beneficiary: '',
  iban: '',
  bankName: '',
  swift: '',
};

/** Egy szöveg tokenjeinek behelyettesítése (üres értéknél a COMPANY-default ugrik be). */
export function applyLegalTokens(text: string, ctx: LegalCompanyContext): string {
  return text.replace(TOKEN_RE, (full, key: string) => {
    const field = TOKEN_MAP[key];
    if (!field) return full;
    const val = ctx[field];
    if (val && val.trim() !== '') return val;
    const fallback = COMPANY_DEFAULT_CONTEXT[field];
    return fallback && fallback.trim() !== '' ? fallback : '';
  });
}

/** Egy blokk-tömb összes szövegmezőjének behelyettesítése. */
export function applyLegalTokensToBlocks(
  blocks: LegalBlock[],
  ctx: LegalCompanyContext,
): LegalBlock[] {
  const s = (t: string) => applyLegalTokens(t, ctx);
  return blocks.map((b): LegalBlock => {
    switch (b.k) {
      case 'h':
      case 'p':
      case 'note':
        return { ...b, t: s(b.t) };
      case 'ul':
      case 'ol':
        return { ...b, items: b.items.map(s) };
      case 'table':
        return { ...b, head: b.head.map(s), rows: b.rows.map((r) => r.map(s)) };
      default:
        return b;
    }
  });
}

/** Egy teljes dokumentum-rekord (cím/alcím/összefoglaló + blokkok) behelyettesítése. */
export function applyLegalTokensToRecord(
  doc: LegalDocRecord,
  ctx: LegalCompanyContext,
): LegalDocRecord {
  return {
    ...doc,
    title: applyLegalTokens(doc.title, ctx),
    subtitle: doc.subtitle != null ? applyLegalTokens(doc.subtitle, ctx) : doc.subtitle,
    summary: applyLegalTokens(doc.summary, ctx),
    blocks: applyLegalTokensToBlocks(doc.blocks, ctx),
  };
}
