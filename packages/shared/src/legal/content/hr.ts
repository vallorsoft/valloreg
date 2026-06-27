import type { LegalDoc } from '../types';
import { COMPANY } from '../company';

// ──────────────────────────────────────────────────────────────────────────
// Documente HR / organizatorice: Politica de confidențialitate a angajaților,
// Procedura de integrare/plecare (onboarding/offboarding).
// Acestea sunt documente organizatorice; conținutul depinde de structura internă
// a companiei și necesită completare de către angajator / avocat.
// ──────────────────────────────────────────────────────────────────────────

const employeeConfidentiality: LegalDoc = {
  slug: 'confidentialitate-angajati',
  category: 'hr',
  title: 'Politica de Confidențialitate a Angajaților',
  subtitle: 'Obligații de confidențialitate ale personalului',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Obligațiile angajaților și colaboratorilor privind confidențialitatea datelor și a informațiilor.',
  blocks: [
    { k: 'h', t: '1. Obiect' },
    {
      k: 'p',
      t: 'Personalul și colaboratorii care au acces la sisteme și date au obligația de a păstra confidențialitatea datelor cu caracter personal și a informațiilor de afaceri ale clienților și ale companiei.',
    },
    { k: 'h', t: '2. Reguli' },
    {
      k: 'ul',
      items: [
        'Acces la date doar pe principiul need-to-know și al privilegiului minim.',
        'Interzicerea divulgării, copierii sau utilizării datelor în alt scop decât cel autorizat.',
        'Utilizarea acceselor de suport doar temporar, justificat și jurnalizat.',
        'Raportarea imediată a oricărui incident de securitate.',
        'Obligația de confidențialitate continuă și după încetarea colaborării.',
      ],
    },
    {
      k: 'note',
      t: `[DE COMPLETAT de avocat / angajator] Acordul de confidențialitate (NDA) semnat de fiecare angajat/colaborator, clauzele contractuale de muncă privind protecția datelor și sancțiunile aplicabile trebuie redactate și semnate. Punct de contact: {{company.email}}.`,
    },
  ],
};

const onboardingOffboarding: LegalDoc = {
  slug: 'onboarding-offboarding',
  category: 'hr',
  title: 'Procedura de Integrare și Plecare (Onboarding/Offboarding)',
  subtitle: 'Gestionarea accesului la angajare și la încetare',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Pașii de acordare a accesului la integrarea unui membru și de revocare la plecarea acestuia.',
  blocks: [
    { k: 'h', t: '1. Integrare (Onboarding)' },
    {
      k: 'ol',
      items: [
        'Semnarea acordului de confidențialitate (NDA).',
        'Crearea contului și acordarea rolului minim necesar (RBAC).',
        'Instruire privind protecția datelor și regulile de securitate.',
        'Înregistrarea accesurilor acordate.',
      ],
    },
    { k: 'h', t: '2. Plecare (Offboarding)' },
    {
      k: 'ol',
      items: [
        'Revocarea imediată a accesului (dezactivarea contului, revocarea token-urilor).',
        'Eliminarea din companiile (tenant) în care era membru.',
        'Revocarea oricăror accese de suport active.',
        'Confirmarea returnării/eliminării echipamentelor și a accesurilor.',
        'Documentarea încetării accesului.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Checklist-ul operațional, responsabilul de proces și termenele de revocare (ideal în aceeași zi) trebuie stabilite intern.',
    },
  ],
};

export const HR_DOCS: LegalDoc[] = [employeeConfidentiality, onboardingOffboarding];
