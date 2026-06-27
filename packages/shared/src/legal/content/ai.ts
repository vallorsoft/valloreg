import type { LegalDoc } from '../types';

// ──────────────────────────────────────────────────────────────────────────
// Documente EU AI Act: Declarație de conformitate, Registrul riscurilor AI,
// Procedură de supraveghere umană, Notă de transparență AI.
// Bazate pe implementarea reală: OCR + extragere Gemini, human-in-the-loop,
// scor de încredere (AUTO_OK/NEEDS_REVIEW), audit al deciziilor AI.
// ──────────────────────────────────────────────────────────────────────────

const aiActStatement: LegalDoc = {
  slug: 'declaratie-ai-act',
  category: 'ai',
  title: 'Declarație de Conformitate cu Regulamentul UE privind IA',
  subtitle: 'Regulamentul (UE) 2024/1689 (AI Act)',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Poziționarea sistemelor AI ale Valloreg față de Regulamentul UE privind inteligența artificială.',
  blocks: [
    {
      k: 'p',
      t: 'Valloreg utilizează inteligența artificială pentru o sarcină delimitată: citirea (OCR) și extragerea de date structurate din documente de service (facturi, certificate de înmatriculare, documente de conformitate). Această declarație descrie poziționarea față de Regulamentul (UE) 2024/1689 (AI Act).',
    },
    { k: 'h', t: '1. Clasificarea riscului' },
    {
      k: 'p',
      t: 'Funcția AI este un instrument de asistență pentru extragerea de date, cu verificare umană obligatorie. Nu realizează identificare biometrică, nu evaluează persoane și nu ia decizii automate cu efecte juridice. Pe baza acestei utilizări, sistemul se încadrează, în evaluarea preliminară, în categoria de risc limitat/minim, fiind supus în principal obligațiilor de transparență.',
    },
    {
      k: 'note',
      t: '[DE VERIFICAT JURIDIC] Clasificarea finală pe categoriile AI Act (risc inacceptabil / ridicat / limitat / minim) și calendarul de aplicare trebuie confirmate de avocat, în funcție de evoluția ghidurilor și de cazurile de utilizare efective.',
    },
    { k: 'h', t: '2. Obligații de transparență' },
    {
      k: 'ul',
      items: [
        'Utilizatorii sunt informați că rezultatele sunt generate de AI (vezi Nota de transparență AI).',
        'Rezultatele sunt marcate cu un scor de încredere și pot necesita verificare (NEEDS_REVIEW).',
      ],
    },
    { k: 'h', t: '3. Furnizor de model' },
    {
      k: 'p',
      t: 'Modelul AI subiacent este furnizat de un terț (Google Gemini), utilizat ca model de uz general. Valloreg integrează modelul; nu îl antrenează cu datele clienților.',
    },
    { k: 'h', t: '4. Supraveghere umană și guvernanță' },
    {
      k: 'p',
      t: 'Toate rezultatele AI sunt supuse verificării umane (human-in-the-loop) și sunt jurnalizate (audit). Detalii: Procedura de supraveghere umană și Registrul riscurilor AI.',
    },
  ],
};

const aiRiskRegister: LegalDoc = {
  slug: 'registru-riscuri-ai',
  category: 'ai',
  title: 'Registrul Riscurilor AI',
  subtitle: 'Identificarea și atenuarea riscurilor sistemelor AI',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary: 'Riscurile asociate utilizării AI/OCR și măsurile de atenuare implementate.',
  blocks: [
    {
      k: 'table',
      head: ['Risc', 'Descriere', 'Atenuare'],
      rows: [
        [
          'Extragere incorectă',
          'Câmpuri citite greșit din document',
          'Scor de încredere; stare NEEDS_REVIEW; câmpuri incerte marcate; verificare umană',
        ],
        [
          'Clasificare greșită',
          'Document/articol clasificat eronat',
          'Confirmare de către utilizator; sistem de învățare din corecții',
        ],
        [
          'Confabulație (hallucination)',
          'Date inventate de model',
          'Validare cu schema strictă (zod); câmpuri necompletate marcate, nu inventate',
        ],
        [
          'Scurgere de date la furnizorul AI',
          'Conținut trimis în afara SEE',
          'Activare opțională; SCC; implicit provider „stub"; minimizarea datelor',
        ],
        [
          'Indisponibilitatea modelului / cote',
          'Limite de utilizare (429)',
          'Lanț de modele cu comutare automată la următorul model',
        ],
        [
          'Părtinire (bias)',
          'Tratament inegal',
          'Sarcină tehnică restrânsă (extragere de date), fără profilarea persoanelor',
        ],
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Evaluarea cantitativă a riscului, pragurile de acceptanță și revizuirea periodică a registrului trebuie definite de echipa tehnică împreună cu DPO/avocatul.',
    },
  ],
};

const humanOversight: LegalDoc = {
  slug: 'supraveghere-umana',
  category: 'ai',
  title: 'Procedura de Supraveghere Umană',
  subtitle: 'Human-in-the-loop',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary: 'Cum asigură Valloreg controlul uman asupra rezultatelor generate de AI.',
  blocks: [
    { k: 'h', t: '1. Principiul' },
    {
      k: 'p',
      t: 'Niciun rezultat AI nu devine date confirmate fără posibilitatea de intervenție umană. Sistemul propune; utilizatorul decide.',
    },
    { k: 'h', t: '2. Flux' },
    {
      k: 'ol',
      items: [
        'Documentul este procesat (OCR + extragere AI).',
        'Rezultatul primește un scor de încredere; starea devine AUTO_OK (încredere ridicată) sau NEEDS_REVIEW.',
        'Utilizatorul verifică, corectează și confirmă (selecție/modificare vehicul, alocare pe articole).',
        'Corecțiile sunt înregistrate și folosite pentru îmbunătățire (învățare).',
        'Toate deciziile AI și confirmările sunt jurnalizate (audit).',
      ],
    },
    { k: 'h', t: '3. Garanții' },
    {
      k: 'ul',
      items: [
        'Câmpurile cu încredere scăzută sunt evidențiate pentru verificare.',
        'Nu există decizii complet automatizate cu efect juridic.',
        'Utilizatorul poate respinge integral rezultatul AI.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Instruirea utilizatorilor privind limitele AI și pragurile de încredere pentru trecerea automată în AUTO_OK trebuie documentate.',
    },
  ],
};

const aiTransparency: LegalDoc = {
  slug: 'transparenta-ai',
  category: 'ai',
  title: 'Notă de Transparență privind IA',
  subtitle: 'Informare pentru utilizatori',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary: 'Informații clare despre utilizarea inteligenței artificiale în Valloreg.',
  blocks: [
    { k: 'h', t: 'Ce face AI-ul' },
    {
      k: 'p',
      t: 'Valloreg folosește OCR și inteligență artificială pentru a citi documentele încărcate și a extrage automat date (furnizor, dată, număr factură, monedă, articole, sume, taxe, candidați nr. înmatriculare/VIN), pe care le clasifică și le propune spre verificare.',
    },
    { k: 'h', t: 'Ce NU face AI-ul' },
    {
      k: 'ul',
      items: [
        'Nu ia decizii cu efect juridic asupra persoanelor.',
        'Nu realizează identificare biometrică sau profilare a persoanelor.',
        'Nu înlocuiește verificarea umană – rezultatele au caracter informativ.',
      ],
    },
    { k: 'h', t: 'Furnizorul modelului' },
    {
      k: 'p',
      t: 'Atunci când funcția este activată, procesarea AI este realizată prin Google Gemini. Datele nu sunt utilizate de Valloreg pentru antrenarea modelelor. Vezi Lista subîmputerniciților și TIA pentru aspectele de transfer.',
    },
    { k: 'h', t: 'Drepturile dumneavoastră' },
    {
      k: 'p',
      t: 'Puteți corecta sau respinge oricând rezultatele AI. Pentru întrebări privind prelucrarea, consultați Politica de Confidențialitate.',
    },
  ],
};

export const AI_DOCS: LegalDoc[] = [aiActStatement, aiRiskRegister, humanOversight, aiTransparency];
