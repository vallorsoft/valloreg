import type { LegalDoc } from '../types';
import { COMPANY } from '../company';

// ──────────────────────────────────────────────────────────────────────────
// Documente de securitate și continuitate: Registrul măsurilor de securitate,
// Plan de răspuns la incidente, Procedură breșă date, Backup & DR, Plan de
// continuitate, Divulgare vulnerabilități, Control acces, Revizuire acces.
// Bazate pe docs/SECURITY.md, main.ts (helmet), auth.service (Argon2/JWT), etc.
// ──────────────────────────────────────────────────────────────────────────

const securityMeasures: LegalDoc = {
  slug: 'registru-masuri-securitate',
  category: 'security',
  title: 'Registrul Măsurilor Tehnice și Organizatorice (TOM)',
  subtitle: 'Art. 32 GDPR – securitatea prelucrării',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Inventarul măsurilor tehnice și organizatorice de securitate implementate în platforma Valloreg.',
  blocks: [
    { k: 'h', t: '1. Control acces și autentificare' },
    {
      k: 'ul',
      items: [
        'Parole stocate exclusiv ca hash Argon2 (niciodată în text clar).',
        'Autentificare cu token-uri JWT: access (durată scurtă, 15 minute) + refresh (14 zile), cu rotație și revocare; refresh token stocat ca hash.',
        'Token de resetare a parolei stocat ca hash, de unică folosință, cu expirare (1 oră).',
        'Control acces bazat pe roluri (RBAC): OWNER, FLEET_MANAGER, ADMIN, ACCOUNTANT, VIEWER (companie) și SUPER_ADMIN (platformă).',
        'Autentificare în doi pași (2FA) – câmp pregătit în model; activarea completă este planificată (vezi nota).',
      ],
    },
    { k: 'h', t: '2. Izolare multi-tenant' },
    {
      k: 'ul',
      items: [
        'Fiecare înregistrare de business conține tenantId.',
        'Extensia Prisma de tenant-scope adaugă automat filtrul de companie la fiecare interogare; interogarea fără context de companie eșuează (fail-closed).',
        'Accesul cross-tenant este exclus la nivel de cod.',
      ],
    },
    { k: 'h', t: '3. Criptare și transport' },
    {
      k: 'ul',
      items: [
        'TLS pentru toate comunicațiile (în tranzit).',
        'Criptare la repaus la nivelul furnizorului de stocare și bază de date.',
        'Documente accesate prin URL pre-semnate (presigned), cu prefix pe companie.',
      ],
    },
    { k: 'h', t: '4. Securitatea aplicației' },
    {
      k: 'ul',
      items: [
        'Antete de securitate HTTP prin Helmet.',
        'CORS restricționat la origini permise (allowlist).',
        'Validarea intrărilor cu zod / class-validator pe fiecare endpoint.',
        'Validare la încărcare: tip MIME și dimensiune (PDF/JPG/PNG, max 25 MB).',
        'Idempotență prin hash SHA-256 al documentului.',
        'Limite de plan impuse pe server (vehicule/utilizatori/stocare/documente).',
      ],
    },
    { k: 'h', t: '5. Jurnalizare și acces de suport' },
    {
      k: 'ul',
      items: [
        'Jurnal de audit pentru operațiunile sensibile (cine, companie, acțiune, resursă, IP, marcă temporală, rezultat).',
        'Operatorul platformei (Super Admin) NU vede implicit conținutul facturilor/documentelor – doar date de sistem, statistici, erori, audit.',
        'Acces de suport temporar (1h / 24h / 7 zile), cu expirare automată și jurnalizare completă.',
      ],
    },
    { k: 'h', t: '6. Gestionarea secretelor' },
    {
      k: 'ul',
      items: [
        'Secretele nu se păstrează în cod; se folosesc variabile de mediu și secret manager (Render).',
        'Chei JWT și de criptare a integrărilor generate sigur.',
      ],
    },
    {
      k: 'note',
      t: '[DE REMEDIAT – urgent] Fișierul .env.example din repository conține o parolă reală de bază de date (Neon). Aceasta trebuie rotită imediat și eliminată din istoricul versiunilor. [DE COMPLETAT] Activarea efectivă a 2FA, politica de gestionare a vulnerabilităților dependențelor și testele automate de izolare cross-tenant trebuie finalizate/documentate.',
    },
  ],
};

const incidentResponse: LegalDoc = {
  slug: 'plan-raspuns-incidente',
  category: 'security',
  title: 'Plan de Răspuns la Incidente',
  subtitle: 'Detectare, clasificare, escaladare',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Procesul de detectare, clasificare și gestionare a incidentelor de securitate.',
  blocks: [
    { k: 'h', t: '1. Clasificarea incidentelor' },
    {
      k: 'table',
      head: ['Severitate', 'Exemple', 'Reacție țintă'],
      rows: [
        ['Critică', 'Compromiterea datelor, indisponibilitate totală, acces neautorizat cross-tenant', 'Imediată'],
        ['Majoră', 'Degradare semnificativă, vulnerabilitate exploatabilă', 'În câteva ore'],
        ['Minoră', 'Erori izolate, fără impact asupra datelor', 'În cadrul programului normal'],
      ],
    },
    { k: 'h', t: '2. Etape' },
    {
      k: 'ol',
      items: [
        'Detectare (monitorizare, jurnale, raportare).',
        'Triaj și clasificare după severitate.',
        'Limitarea efectelor (containment).',
        'Eradicare și remediere.',
        'Recuperare și verificare.',
        'Analiză post-incident și lecții învățate.',
      ],
    },
    { k: 'h', t: '3. Notificare' },
    {
      k: 'p',
      t: `Dacă incidentul constituie o încălcare a securității datelor cu caracter personal, se aplică Procedura privind încălcarea securității datelor: notificarea ${COMPANY.dpa} în cel mult 72 de ore, dacă este cazul. Punct de contact intern: ${COMPANY.email}.`,
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Lista persoanelor de contact (echipa de răspuns), canalele de escaladare, instrumentele de monitorizare/alertare și pragurile concrete trebuie definite operațional.',
    },
  ],
};

const breach: LegalDoc = {
  slug: 'procedura-bresa-date',
  category: 'security',
  title: 'Procedură privind Încălcarea Securității Datelor',
  subtitle: 'Art. 33–34 GDPR',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Pașii de gestionare a unei încălcări a securității datelor cu caracter personal și obligațiile de notificare.',
  blocks: [
    { k: 'h', t: '1. Pași' },
    {
      k: 'ol',
      items: [
        'Identificarea și documentarea încălcării (ce date, câte persoane, cum).',
        'Evaluarea riscului pentru drepturile și libertățile persoanelor vizate.',
        'Limitarea efectelor și remedierea.',
        'Notificarea ANSPDCP în cel mult 72 de ore de la luarea la cunoștință, dacă există un risc.',
        'Notificarea persoanelor vizate fără întârziere nejustificată, dacă riscul este ridicat (art. 34).',
        'Înregistrarea în registrul intern al încălcărilor (indiferent de notificare).',
      ],
    },
    { k: 'h', t: '2. Rolul de persoană împuternicită' },
    {
      k: 'p',
      t: 'Pentru încălcările privind conținutul documentelor (unde Valloreg este împuternicit), compania-client operator este informată fără întârziere nejustificată, pentru ca aceasta să își îndeplinească obligațiile de notificare.',
    },
    { k: 'h', t: '3. Conținutul minim al notificării' },
    {
      k: 'ul',
      items: [
        'Natura încălcării și categoriile/numărul aproximativ de persoane și înregistrări.',
        'Datele de contact ale punctului de informare.',
        'Consecințele probabile.',
        'Măsurile luate sau propuse.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Șablonul de notificare către ANSPDCP și către persoanele vizate și registrul intern al încălcărilor trebuie pregătite de avocat / DPO.',
    },
  ],
};

const backupDr: LegalDoc = {
  slug: 'backup-disaster-recovery',
  category: 'security',
  title: 'Plan de Backup și Recuperare în caz de Dezastru',
  subtitle: 'Backup, RPO/RTO, testare',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Strategia de copii de rezervă și de recuperare a serviciului în caz de dezastru.',
  blocks: [
    { k: 'h', t: '1. Componente și mecanisme' },
    {
      k: 'table',
      head: ['Componentă', 'Mecanism de backup'],
      rows: [
        ['Bază de date (PostgreSQL/Neon)', 'Backup-uri gestionate de furnizor (snapshot/point-in-time)'],
        ['Stocare obiecte (documente)', 'Reziliența furnizorului de stocare'],
        ['Cozi (Redis/BullMQ)', 'Date tranzitorii; joburile sunt idempotente și reluabile'],
        ['Configurație/secrete', 'Gestionate în secret manager (Render)'],
      ],
    },
    { k: 'h', t: '2. Recuperare' },
    {
      k: 'ul',
      items: [
        'Restaurarea bazei de date din backup-ul furnizorului.',
        'Re-deploy automat al serviciilor din repository (infrastructure as code – render.yaml).',
        'Migrațiile rulează idempotent la pornire.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT – important] Obiectivele RPO (Recovery Point Objective) și RTO (Recovery Time Objective), frecvența backup-urilor, durata de retenție a copiilor și testarea periodică a restaurării trebuie definite și consemnate. În prezent, backup-ul se bazează pe capabilitățile gestionate ale furnizorilor; testele de restaurare programate nu sunt documentate.',
    },
  ],
};

const bcp: LegalDoc = {
  slug: 'plan-continuitate',
  category: 'security',
  title: 'Plan de Continuitate a Activității (BCP)',
  subtitle: 'Servicii critice și restaurare prioritară',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Asigurarea continuității serviciilor critice în cazul unei întreruperi majore.',
  blocks: [
    { k: 'h', t: '1. Servicii critice' },
    {
      k: 'ul',
      items: [
        'Autentificare și acces la cont.',
        'Bază de date (date de business izolate pe companie).',
        'Stocarea documentelor.',
        'API-ul aplicației.',
      ],
    },
    { k: 'h', t: '2. Măsuri de reziliență' },
    {
      k: 'ul',
      items: [
        'API stateless, scalabil orizontal în spatele Render.',
        'Workeri separați, scalabili pe baza cozii.',
        'Conexiuni de bază de date în pool (Neon pooler).',
        'Verificare de sănătate (health check) la /api/health.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Analiza impactului asupra activității (BIA), prioritizarea proceselor, scenariile de criză, responsabilii și exercițiile periodice trebuie definite. Notă: planul de găzduire curent (Render free) poate avea limitări de disponibilitate care trebuie evaluate pentru producție.',
    },
  ],
};

const vulnDisclosure: LegalDoc = {
  slug: 'divulgare-vulnerabilitati',
  category: 'security',
  title: 'Politica de Divulgare a Vulnerabilităților',
  subtitle: 'Raportare responsabilă',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Cum pot fi raportate în mod responsabil vulnerabilitățile de securitate.',
  blocks: [
    {
      k: 'p',
      t: 'Apreciem eforturile cercetătorilor de securitate. Raportarea vulnerabilităților este permisă exclusiv cu bună-credință, fără afectarea disponibilității serviciului și fără accesarea datelor altor utilizatori.',
    },
    { k: 'h', t: '1. Reguli' },
    {
      k: 'ul',
      items: [
        'Nu efectuați atacuri de tip DoS, spam sau inginerie socială.',
        'Nu accesați, modificați sau ștergeți date care nu vă aparțin.',
        'Acordați un termen rezonabil pentru remediere înainte de divulgarea publică.',
      ],
    },
    { k: 'h', t: '2. Cum raportați' },
    {
      k: 'p',
      t: `Trimiteți detaliile (pași de reproducere, impact) la ${COMPANY.email}. Confirmăm primirea și vă informăm despre stadiul remedierii.`,
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Termenele de răspuns (SLA de triaj), eventualul „safe harbor" juridic pentru cercetători și existența unui canal dedicat (de ex. security@) trebuie stabilite.',
    },
  ],
};

const accessControl: LegalDoc = {
  slug: 'control-acces',
  category: 'security',
  title: 'Politica de Control al Accesului',
  subtitle: 'Roluri, privilegiu minim, need-to-know',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Regulile de acordare și gestionare a accesului la sisteme și date.',
  blocks: [
    { k: 'h', t: '1. Principii' },
    {
      k: 'ul',
      items: [
        'Privilegiu minim și need-to-know.',
        'Acces bazat pe roluri (RBAC) aplicat pe server, nu doar în interfață.',
        'Separarea atribuțiilor între rolurile de companie și cele de platformă.',
      ],
    },
    { k: 'h', t: '2. Roluri' },
    {
      k: 'table',
      head: ['Rol', 'Nivel', 'Domeniu tipic'],
      rows: [
        ['OWNER', 'Companie', 'Control deplin asupra companiei'],
        ['ADMIN', 'Companie', 'Administrare utilizatori și setări'],
        ['FLEET_MANAGER', 'Companie', 'Gestionarea vehiculelor și documentelor'],
        ['ACCOUNTANT', 'Companie', 'Acces la date financiare/rapoarte'],
        ['VIEWER', 'Companie', 'Doar vizualizare'],
        ['SUPER_ADMIN', 'Platformă', 'Administrare sistem, fără acces implicit la conținut'],
      ],
    },
    { k: 'h', t: '3. Acordare și revocare' },
    {
      k: 'ul',
      items: [
        'Utilizatorii sunt adăugați prin invitație pe e-mail, cu rol explicit.',
        'Accesul de suport este temporar și jurnalizat.',
        'Revocarea token-urilor de reîmprospătare la schimbarea parolei/încetare.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Politica de parole (complexitate minimă), blocarea după încercări eșuate și activarea obligatorie a 2FA pentru rolurile privilegiate trebuie definite/implementate.',
    },
  ],
};

const accessReview: LegalDoc = {
  slug: 'revizuire-acces',
  category: 'security',
  title: 'Procedura de Revizuire a Accesului Utilizatorilor',
  subtitle: 'Reevaluarea periodică a drepturilor',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Cum și cât de des se revizuiește accesul utilizatorilor la date.',
  blocks: [
    { k: 'h', t: '1. Scop' },
    {
      k: 'p',
      t: 'Reevaluarea periodică a drepturilor de acces pentru a asigura că fiecare utilizator are doar accesul necesar.',
    },
    { k: 'h', t: '2. Procedură' },
    {
      k: 'ol',
      items: [
        'Inventarierea membrilor și rolurilor fiecărei companii (memberships).',
        'Verificarea conturilor de platformă (isPlatformAdmin) și a acceselor de suport active.',
        'Eliminarea conturilor/rolurilor inutile și a invitațiilor expirate.',
        'Documentarea revizuirii și a deciziilor.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Frecvența (de ex. trimestrial), responsabilul revizuirii și un raport/checklist standard trebuie stabilite. În prezent nu există un instrument automat de raportare a accesului; revizuirea se face manual pe baza datelor din sistem.',
    },
  ],
};

export const SECURITY_DOCS: LegalDoc[] = [
  securityMeasures,
  incidentResponse,
  breach,
  backupDr,
  bcp,
  vulnDisclosure,
  accessControl,
  accessReview,
];
