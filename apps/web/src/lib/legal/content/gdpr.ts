import type { LegalDoc } from '../types';
import { COMPANY, companyIdentityItems } from '../company';

// ──────────────────────────────────────────────────────────────────────────
// Documente GDPR de bază: ROPA, DPIA, TIA, Politica de retenție, Procedura
// internă GDPR, Registrul subîmputerniciților. Conținut bazat pe schema Prisma
// reală, render.yaml, .env.example și docs/SECURITY.md.
// ──────────────────────────────────────────────────────────────────────────

const ropa: LegalDoc = {
  slug: 'ropa',
  category: 'gdpr',
  title: 'Registrul Activităților de Prelucrare (ROPA)',
  subtitle: 'Conform art. 30 GDPR',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Evidența activităților de prelucrare a datelor cu caracter personal desfășurate de VALLOR TEAM SRL, în calitate de operator și de persoană împuternicită.',
  blocks: [
    { k: 'h', t: 'Identificarea operatorului' },
    { k: 'ul', items: companyIdentityItems() },
    {
      k: 'note',
      t: 'Registrul reflectă implementarea tehnică reală a platformei la data ultimei actualizări. Necesită revizuire juridică și actualizare la fiecare modificare semnificativă a prelucrărilor.',
    },
    { k: 'h', t: 'Activitatea 1 – Gestionarea conturilor și a utilizatorilor (operator)' },
    {
      k: 'table',
      head: ['Element', 'Detaliu'],
      rows: [
        ['Scop', 'Înregistrare, autentificare, gestionarea companiilor (tenant), a membrilor și a rolurilor'],
        ['Categorii de persoane vizate', 'Utilizatori (administratori și angajați ai companiilor-client), persoane invitate'],
        ['Categorii de date', 'E-mail, hash parolă (Argon2), nume (opțional), secret 2FA (opțional), rol, asociere utilizator–companie, e-mail invitație'],
        ['Temei juridic', 'Art. 6(1)(b) – executarea contractului'],
        ['Destinatari', 'Furnizor găzduire (Render), bază de date (Neon), e-mail (Brevo)'],
        ['Transfer extra-SEE', 'Nu (infrastructură UE – Frankfurt)'],
        ['Termen de stocare', 'Pe durata contului; ștergere la cererea clientului (vezi Politica de retenție)'],
        ['Măsuri de securitate', 'Hash Argon2, JWT, RBAC, izolare pe tenant, audit, TLS'],
      ],
    },
    { k: 'h', t: 'Activitatea 2 – Procesarea documentelor încărcate (persoană împuternicită)' },
    {
      k: 'table',
      head: ['Element', 'Detaliu'],
      rows: [
        ['Scop', 'OCR + extragere AI, clasificare, asociere la vehicul, construirea istoricului de service'],
        ['Rol', 'Persoană împuternicită; operator este compania-client'],
        ['Categorii de date', 'Conținutul documentelor (facturi, certificate de înmatriculare, documente de conformitate): nume de pe certificat, nr. înmatriculare/VIN, date furnizor, sume, date tehnice extrase (extractionRaw)'],
        ['Temei juridic', 'Stabilit de operatorul-client; prelucrarea de către Valloreg se face în baza DPA (art. 28 GDPR)'],
        ['Destinatari / subîmputerniciți', 'Stocare obiecte (Cloudflare R2 / MinIO), AI (Google Gemini – când este activat)'],
        ['Transfer extra-SEE', 'Posibil când AI (Gemini) este activat – vezi TIA'],
        ['Termen de stocare', 'Până la ștergerea documentului de către client (fișierul se șterge și din stocare)'],
        ['Măsuri', 'Izolare pe tenant, presigned URL, validare MIME/dimensiune (PDF/JPG/PNG, max 25 MB), hash SHA-256 (idempotență), audit'],
      ],
    },
    { k: 'h', t: 'Activitatea 3 – Securitate, audit și prevenirea abuzului (operator)' },
    {
      k: 'table',
      head: ['Element', 'Detaliu'],
      rows: [
        ['Scop', 'Jurnalizarea operațiunilor sensibile, detectarea abuzului, suport tehnic'],
        ['Categorii de date', 'userId, tenantId, acțiune, tip resursă, IP, marcă temporală, metadate; acces de suport temporar (1h/24h/7d), jurnalizat'],
        ['Temei juridic', 'Art. 6(1)(f) – interes legitim (securitate)'],
        ['Termen de stocare', '[DE STABILIT] termen de retenție a jurnalelor de audit'],
      ],
    },
    { k: 'h', t: 'Activitatea 4 – Notificări (push + e-mail) (operator/împuternicit)' },
    {
      k: 'table',
      head: ['Element', 'Detaliu'],
      rows: [
        ['Scop', 'Mementouri de mentenanță/conformitate, rapoarte lunare, e-mailuri de cont (resetare parolă, invitații)'],
        ['Categorii de date', 'E-mail, abonament push (endpoint, chei p256dh/auth, user-agent)'],
        ['Temei juridic', 'Art. 6(1)(b) și, pentru push, Art. 6(1)(a) – consimțământ'],
        ['Destinatari', 'Brevo (e-mail), serviciul de push al browserului (Web Push / VAPID)'],
      ],
    },
    { k: 'h', t: 'Activitatea 5 – Benchmark de flotă anonimizat (operator)' },
    {
      k: 'p',
      t: 'Tendințele de cost („tendințe europene") se calculează exclusiv din date AGREGATE și anonimizate, cu o poartă de k-anonimitate (un segment devine public doar dacă provine de la cel puțin 5 companii și 20 de vehicule diferite). Tabelul de benchmark NU conține tenantId sau identificatori; companiile pot opta să nu contribuie (opt-out). Întrucât rezultatul este anonim, nu reprezintă date cu caracter personal, dar procesul de agregare este inclus aici pentru transparență.',
    },
  ],
};

const dpia: LegalDoc = {
  slug: 'dpia',
  category: 'gdpr',
  title: 'Evaluarea Impactului asupra Protecției Datelor (DPIA)',
  subtitle: 'Conform art. 35 GDPR – funcțiile OCR/AI',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Evaluarea riscurilor asupra drepturilor persoanelor vizate pentru prelucrarea documentelor prin OCR și AI și măsurile de atenuare.',
  blocks: [
    {
      k: 'p',
      t: 'Această DPIA evaluează prelucrarea care implică OCR și inteligență artificială (extragerea de date din documente încărcate), prelucrarea pe scară a documentelor de afaceri și utilizarea de subîmputerniciți, inclusiv un potențial transfer către un furnizor AI.',
    },
    {
      k: 'note',
      t: '[DE VERIFICAT JURIDIC] Necesitatea formală a unei DPIA depinde de evaluarea criteriilor art. 35 GDPR și a listei ANSPDCP. Acest document oferă o evaluare proactivă și trebuie avizat de avocat / DPO.',
    },
    { k: 'h', t: '1. Descrierea sistematică a prelucrării' },
    {
      k: 'ul',
      items: [
        'Utilizatorul încarcă un document (PDF/JPG/PNG) prin API; fișierul este stocat în spațiul de obiecte cu izolare pe companie.',
        'Un job asincron (BullMQ/Redis) rulează OCR (extragerea textului) și apoi extragerea AI a câmpurilor structurate.',
        'Rezultatul este clasificat și propus utilizatorului spre verificare (human-in-the-loop); starea documentului devine AUTO_OK sau NEEDS_REVIEW pe baza unui scor de încredere.',
        'Documentele pot conține date cu caracter personal (de ex. nume pe certificatul de înmatriculare, nr. înmatriculare/VIN).',
      ],
    },
    { k: 'h', t: '2. Necesitate și proporționalitate' },
    {
      k: 'p',
      t: 'Prelucrarea este necesară pentru scopul declarat (automatizarea istoricului de service). Se aplică minimizarea: la scanarea certificatului de înmatriculare, numele proprietarului (dată personală) este utilizat doar pentru verificare și NU este persistat. Datele rămân izolate pe companie.',
    },
    { k: 'h', t: '3. Evaluarea riscurilor' },
    {
      k: 'table',
      head: ['Risc', 'Probabilitate', 'Impact', 'Măsuri de atenuare'],
      rows: [
        ['Acces neautorizat între companii', 'Scăzută', 'Ridicat', 'Izolare pe tenant (Prisma scope, fail-closed), RBAC, audit'],
        ['Expunerea conținutului către operatorul platformei', 'Scăzută', 'Ridicat', 'Super Admin nu vede implicit conținutul; acces de suport temporar și jurnalizat'],
        ['Extragere AI eronată', 'Medie', 'Mediu', 'Human-in-the-loop, scor de încredere, marcarea câmpurilor incerte'],
        ['Transfer de date la furnizorul AI', 'Medie', 'Mediu', 'Activabil opțional; SCC; vezi TIA; implicit provider „stub"'],
        ['Pierderea/alterarea datelor', 'Scăzută', 'Ridicat', 'Backup gestionat de furnizor, TLS, criptare la repaus, hash SHA-256'],
      ],
    },
    { k: 'h', t: '4. Concluzie' },
    {
      k: 'p',
      t: 'Cu măsurile implementate, riscul rezidual este evaluat ca scăzut spre mediu. DPIA se reevaluează la activarea provider-ului AI în producție și la orice schimbare semnificativă.',
    },
    {
      k: 'note',
      t: '[DE COMPLETAT] Evaluarea formală a riscului rezidual și decizia de consultare prealabilă a ANSPDCP (art. 36) rămân în sarcina DPO/avocatului.',
    },
  ],
};

const tia: LegalDoc = {
  slug: 'tia',
  category: 'gdpr',
  title: 'Evaluarea Impactului Transferurilor (TIA)',
  subtitle: 'Transferuri de date în afara SEE',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Evaluarea transferurilor de date cu caracter personal către furnizori situați în afara SEE și a măsurilor suplimentare.',
  blocks: [
    {
      k: 'p',
      t: 'Această TIA analizează transferurile de date care pot avea loc în afara Spațiului Economic European (SEE), în urma hotărârii Schrems II și a recomandărilor EDPB 01/2020.',
    },
    { k: 'h', t: '1. Cartografierea infrastructurii' },
    {
      k: 'table',
      head: ['Furnizor', 'Rol', 'Localizare', 'Transfer extra-SEE'],
      rows: [
        ['Render', 'Găzduire API/web + cozi (Redis)', 'UE – Frankfurt', 'Nu (regiune UE)'],
        ['Neon', 'Bază de date PostgreSQL', 'UE – AWS eu-central-1 (Frankfurt)', 'Nu (regiune UE)'],
        ['Cloudflare R2', 'Stocare obiecte (documente)', 'Configurabil / global', '[DE VERIFICAT] regiunea bucket-ului'],
        ['Brevo', 'Trimitere e-mail', 'UE (Franța)', 'Nu'],
        ['Google Gemini', 'OCR + extragere AI (opțional)', 'Google (posibil SUA)', 'Da, când este activat'],
      ],
    },
    { k: 'h', t: '2. Transferul principal evaluat: Google Gemini' },
    {
      k: 'p',
      t: 'Când funcția AI este activată (EXTRACTION_PROVIDER/OCR_PROVIDER = gemini), textul/imaginea documentului este transmisă către API-ul Google pentru procesare. Documentele pot conține date cu caracter personal. În configurația implicită de producție (render.yaml), provider-ul este „stub", deci nu are loc transfer AI până la activarea explicită cu o cheie API.',
    },
    { k: 'h', t: '3. Instrumentul de transfer și măsuri suplimentare' },
    {
      k: 'ul',
      items: [
        'Instrument: Clauze Contractuale Standard (SCC) ale furnizorului, completate de Adendumul privind prelucrarea datelor.',
        'Măsuri tehnice: TLS în tranzit; minimizarea datelor trimise; posibilitatea de a menține provider-ul „stub" sau de a alege un provider UE.',
        'Măsuri organizatorice: verificare periodică a politicilor furnizorului; activare AI doar dacă este necesar.',
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT de avocat] Evaluarea legislației din țara terță, garanțiile SCC actualizate, eventualele decizii de adecvare (de ex. EU–US Data Privacy Framework, dacă furnizorul este certificat) și concluzia privind nivelul de protecție esențial echivalent trebuie finalizate juridic. Verificați și regiunea exactă a bucket-ului Cloudflare R2.',
    },
  ],
};

const retention: LegalDoc = {
  slug: 'retentie',
  category: 'gdpr',
  title: 'Politica și Programul de Retenție a Datelor',
  subtitle: 'Durate de păstrare și ștergere',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Cât timp sunt păstrate categoriile de date și cum se realizează ștergerea.',
  blocks: [
    {
      k: 'p',
      t: 'Datele sunt păstrate doar atât timp cât este necesar pentru scopurile declarate sau conform obligațiilor legale. Tabelul de mai jos reflectă comportamentul implementat și obligațiile aplicabile.',
    },
    {
      k: 'table',
      head: ['Categorie de date', 'Termen de păstrare', 'Mecanism'],
      rows: [
        ['Cont utilizator și companie', 'Pe durata contractului', 'Ștergere la cerere; ștergerea companiei elimină în cascadă datele asociate'],
        ['Documente încărcate și date extrase', 'Până la ștergerea de către client', 'La ștergerea documentului, fișierul este eliminat și din stocare'],
        ['Token-uri de reîmprospătare', `${(1209600 / 86400)} zile (TTL)`, 'Expirare/revocare automată'],
        ['Token de resetare parolă', '1 oră (TTL)', 'Expirare; de unică folosință'],
        ['Invitații', '7 zile (TTL)', 'Expirare automată'],
        ['Jurnale de audit', '365 de zile (implicit, configurabil)', 'Ștergere automată zilnică (job de retenție)'],
        ['Date financiar-contabile (facturare)', 'Conform legii (de regulă 10 ani)', 'Obligație legală'],
        ['Backup-uri', 'Conform politicii furnizorului', 'Vezi Plan Backup & Disaster Recovery'],
      ],
    },
    {
      k: 'p',
      t: 'Există un job automat zilnic de retenție care șterge înregistrările tehnice expirate/inutile: jurnale de audit mai vechi decât termenul configurat, token-uri de reîmprospătare și de resetare expirate/revocate, invitații expirate și accese de suport expirate/revocate. Termenele sunt configurabile prin variabile de mediu.',
    },
    {
      k: 'p',
      t: 'Persoanele vizate / clienții pot exercita drepturile prin funcții de auto-servire în aplicație (secțiunea „Cont"): exportul datelor (JSON) și ștergerea contului, respectiv ștergerea întregii companii și a tuturor datelor (doar proprietarul). La ștergere, fișierele asociate sunt eliminate și din spațiul de stocare.',
    },
    {
      k: 'note',
      t: '[DE VERIFICAT JURIDIC] Termenele implicite (de ex. 365 de zile pentru jurnalele de audit) trebuie validate față de obligațiile legale concrete (contabile, fiscale, de securitate). Ștergerea documentelor de business rămâne la inițiativa clientului (operator); platforma nu le șterge automat după o perioadă, pentru a nu pierde istoricul de service necesar clientului.',
    },
  ],
};

const internalGdpr: LegalDoc = {
  slug: 'procedura-gdpr-interna',
  category: 'gdpr',
  title: 'Procedura Internă GDPR',
  subtitle: 'Guvernanța protecției datelor și cererile persoanelor vizate',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Reguli interne de prelucrare, principiul need-to-know și procedura de soluționare a cererilor persoanelor vizate (DSR).',
  blocks: [
    { k: 'h', t: '1. Principii' },
    {
      k: 'ul',
      items: [
        'Accesul la date se acordă pe principiul need-to-know și al privilegiului minim.',
        'Toate operațiunile sensibile sunt jurnalizate (audit).',
        'Datele companiilor sunt izolate; operatorul platformei nu accesează conținutul fără acces de suport temporar și jurnalizat.',
        'Protecția datelor din concepție și implicit (privacy by design & by default).',
      ],
    },
    { k: 'h', t: '2. Procedura pentru cererile persoanelor vizate (DSR)' },
    {
      k: 'ol',
      items: [
        `Recepția cererii la ${COMPANY.email} și înregistrarea acesteia.`,
        'Verificarea identității solicitantului.',
        'Stabilirea rolului (operator sau împuternicit) – cererile privind conținutul documentelor se redirecționează către compania-client operator.',
        'Identificarea datelor și pregătirea răspunsului (acces, rectificare, ștergere, restricționare, portabilitate, opoziție).',
        'Răspuns în cel mult 30 de zile (cu posibilă prelungire de 2 luni, justificată).',
        'Documentarea cererii și a soluționării.',
      ],
    },
    { k: 'h', t: '3. Roluri și responsabilități' },
    {
      k: 'note',
      t: '[DE COMPLETAT] Desemnarea persoanelor responsabile interne (punct de contact protecția datelor, eventual DPO), procedura de instruire periodică a personalului și revizuirea anuală a acestei proceduri.',
    },
  ],
};

const subprocessors: LegalDoc = {
  slug: 'registru-subimputerniciti',
  category: 'gdpr',
  title: 'Registrul Complet al Subîmputerniciților',
  subtitle: 'Furnizori care prelucrează date în numele Valloreg',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Lista furnizorilor (subîmputerniciți) utilizați operațional, scopul, localizarea și instrumentul de transfer.',
  blocks: [
    {
      k: 'p',
      t: 'Pentru furnizarea serviciului utilizăm următorii subîmputerniciți. Lista reflectă integrările din configurația reală (render.yaml, .env.example).',
    },
    {
      k: 'table',
      head: ['Furnizor', 'Scop', 'Date prelucrate', 'Localizare', 'Instrument transfer'],
      rows: [
        ['Render', 'Găzduire API/web, cozi Redis (BullMQ)', 'Toate (la nivel de infrastructură)', 'UE – Frankfurt', 'N/A (UE)'],
        ['Neon', 'Bază de date PostgreSQL gestionată', 'Date cont, business, audit', 'UE – AWS eu-central-1', 'N/A (UE)'],
        ['Cloudflare R2', 'Stocare obiecte (documente)', 'Documente încărcate', 'Configurabil', 'DPA + SCC [DE VERIFICAT regiune]'],
        ['Brevo (Sendinblue)', 'Trimitere e-mail tranzacțional', 'E-mail, conținut notificare', 'UE (Franța)', 'N/A (UE)'],
        ['Google (Gemini API)', 'OCR + extragere AI (opțional)', 'Conținut document', 'Posibil SUA', 'SCC / DPF [DE VERIFICAT]'],
        ['Serviciu Web Push (VAPID)', 'Livrare notificări push', 'Endpoint push, user-agent', 'Depinde de browser', 'N/A'],
        ['API verificare RO (ITP/RCA/rovinietă)', 'Verificare conformitate vehicul (opțional)', 'Nr. înmatriculare', 'Furnizor terț [DE STABILIT]', 'Implicit „stub" (fără transfer)'],
      ],
    },
    {
      k: 'note',
      t: '[DE COMPLETAT de avocat] Pentru fiecare subîmputernicit trebuie să existe un contract de prelucrare (DPA/art. 28) semnat. Verificați entitatea juridică exactă, regiunea de stocare (în special Cloudflare R2) și certificările de transfer (de ex. EU–US DPF) înainte de publicare. Configurația implicită de producție folosește provideri „stub" pentru AI și verificare RO.',
    },
  ],
};

export const GDPR_DOCS: LegalDoc[] = [
  ropa,
  dpia,
  tia,
  retention,
  internalGdpr,
  subprocessors,
];
