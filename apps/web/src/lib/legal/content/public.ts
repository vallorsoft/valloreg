import type { LegalDoc } from '@/lib/legal/types';
import { COMPANY, companyIdentityItems } from '@/lib/legal/company';

// ──────────────────────────────────────────────────────────────────────────
// Dokumentumok publice (vizibile vizitatorilor landing page-ului):
// Politica de confidențialitate, Termeni și condiții, Politica de cookie-uri.
// Conținut bazat pe implementarea reală (vezi schema Prisma, render.yaml,
// .env.example, docs/SECURITY.md). Marcat pentru revizuire juridică.
// ──────────────────────────────────────────────────────────────────────────

const privacy: LegalDoc = {
  slug: 'confidentialitate',
  category: 'public',
  title: 'Politica de Confidențialitate',
  subtitle: 'Modul în care Valloreg prelucrează datele cu caracter personal',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Cum colectează, utilizează, stochează și protejează VALLOR TEAM SRL datele cu caracter personal, conform GDPR și Legii 190/2018.',
  blocks: [
    {
      k: 'p',
      t: 'Această politică descrie modul în care platforma Valloreg prelucrează datele cu caracter personal furnizate în timpul utilizării serviciului. Prelucrarea se realizează în conformitate cu Regulamentul (UE) 2016/679 (GDPR), Legea nr. 190/2018 privind măsurile de punere în aplicare a GDPR și Directiva 2002/58/CE (ePrivacy), astfel cum a fost transpusă în legislația română.',
    },
    { k: 'h', t: '1. Operatorul de date' },
    { k: 'ul', items: companyIdentityItems() },
    {
      k: 'note',
      t: 'Valloreg are un dublu rol: (a) OPERATOR pentru datele de cont, de facturare și de utilizare ale clienților săi (companii); (b) PERSOANĂ ÎMPUTERNICITĂ pentru conținutul documentelor încărcate de client (facturi, certificate de înmatriculare etc.), pentru care clientul-companie rămâne operator. Detalii în Acordul de prelucrare a datelor (DPA).',
    },
    { k: 'h', t: '2. Ce date prelucrăm' },
    {
      k: 'p',
      t: 'În calitate de operator pentru relația cu clientul-companie, prelucrăm:',
    },
    {
      k: 'ul',
      items: [
        'Date de cont ale utilizatorilor: adresă de e-mail, parolă (stocată exclusiv ca hash Argon2, niciodată în text clar), nume (opțional), secret pentru autentificarea în doi pași (opțional).',
        'Date ale companiei (tenant): denumire, cod fiscal/CUI, persoană de contact, e-mail, telefon.',
        'Date de invitare și apartenență: e-mailul persoanelor invitate, rolul atribuit, asocierea utilizator–companie.',
        'Date tehnice de securitate: token-uri de reîmprospătare și de resetare a parolei (stocate ca hash), adrese IP și jurnalele de audit (cine, ce acțiune, asupra cărei resurse, când, rezultat).',
        'Date pentru notificări push (dacă sunt activate de utilizator): identificatorul abonamentului push al browserului și user-agent.',
      ],
    },
    {
      k: 'p',
      t: 'În calitate de persoană împuternicită, prelucrăm conținutul documentelor încărcate de client, care pot conține date cu caracter personal (de ex. numele de pe un certificat de înmatriculare, numărul de înmatriculare/VIN, date ale furnizorilor). Aceste documente sunt stocate în spațiul de obiecte (S3-compatibil) cu izolare pe companie.',
    },
    { k: 'h', t: '3. Scopul și temeiul prelucrării' },
    {
      k: 'table',
      head: ['Scop', 'Temei juridic (GDPR)'],
      rows: [
        ['Crearea contului, autentificare, gestionarea companiei și a rolurilor', 'Art. 6(1)(b) – executarea contractului'],
        ['Furnizarea serviciului (procesare OCR/AI a documentelor, istoric de service, mementouri)', 'Art. 6(1)(b) – executarea contractului'],
        ['Facturare și administrarea abonamentului', 'Art. 6(1)(c) – obligație legală; Art. 6(1)(b)'],
        ['Securitate, jurnale de audit, prevenirea abuzului', 'Art. 6(1)(f) – interes legitim'],
        ['Notificări push și e-mail de tip mementou/raport', 'Art. 6(1)(b) și, după caz, Art. 6(1)(a) – consimțământ (push)'],
        ['Benchmark de flotă anonimizat („tendințe europene")', 'Art. 6(1)(f) – interes legitim, cu opt-out și anonimizare (k-anonimitate)'],
      ],
    },
    { k: 'h', t: '4. Destinatari și subîmputerniciți' },
    {
      k: 'p',
      t: 'Pentru funcționarea serviciului utilizăm furnizori (subîmputerniciți) precum găzduire, bază de date, stocare obiecte, e-mail și, atunci când este activat, procesare AI. Lista completă și actualizată este disponibilă în Registrul subîmputerniciților.',
    },
    { k: 'h', t: '5. Transferuri internaționale' },
    {
      k: 'p',
      t: 'Infrastructura principală (găzduire, bază de date, cozi de procesare) este localizată în Uniunea Europeană (regiunea Frankfurt). Atunci când funcția de extragere AI este activată (Google Gemini), anumite date pot fi transferate în afara SEE; aceste transferuri sunt evaluate în Evaluarea Impactului Transferurilor (TIA) și se bazează pe clauze contractuale standard (SCC). Vezi și Lista subîmputerniciților.',
    },
    { k: 'h', t: '6. Perioada de stocare' },
    {
      k: 'p',
      t: 'Datele sunt păstrate pe durata existenței contului și ulterior conform obligațiilor legale (de ex. evidențe financiar-contabile). La ștergerea unui document, fișierul aferent este eliminat și din spațiul de stocare. Detalii: Politica de retenție a datelor.',
    },
    { k: 'h', t: '7. Drepturile dumneavoastră' },
    {
      k: 'ul',
      items: [
        'Dreptul de acces la date și de a obține o copie;',
        'Dreptul la rectificare;',
        'Dreptul la ștergere („dreptul de a fi uitat");',
        'Dreptul la restricționarea prelucrării;',
        'Dreptul la portabilitatea datelor;',
        'Dreptul de a vă opune prelucrării întemeiate pe interes legitim;',
        'Dreptul de a vă retrage consimțământul, fără a afecta legalitatea prelucrării anterioare;',
        'Dreptul de a depune o plângere la ANSPDCP.',
      ],
    },
    {
      k: 'p',
      t: `Pentru exercitarea drepturilor ne puteți contacta la ${COMPANY.email}. Răspundem în cel mult 30 de zile. Plângerile se pot adresa ${COMPANY.dpa}, ${COMPANY.dpaWeb}.`,
    },
    {
      k: 'note',
      t: '[DE VERIFICAT JURIDIC] Desemnarea unui Responsabil cu protecția datelor (DPO) și existența unui DPO formal nu sunt obligatorii în toate cazurile; necesitatea trebuie evaluată de avocat. În prezent punctul de contact pentru protecția datelor este adresa de e-mail a companiei.',
    },
    { k: 'h', t: '8. Decizii automatizate și AI' },
    {
      k: 'p',
      t: 'Serviciul utilizează OCR și AI pentru a citi și structura documentele, însă rezultatul este propus utilizatorului spre verificare (human-in-the-loop). Nu se iau decizii bazate exclusiv pe prelucrarea automată care să producă efecte juridice asupra persoanelor vizate. Detalii: Nota de transparență AI.',
    },
  ],
};

const terms: LegalDoc = {
  slug: 'termeni-si-conditii',
  category: 'public',
  title: 'Termeni și Condiții',
  subtitle: 'Condițiile de utilizare a serviciului Valloreg',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Condițiile contractuale de utilizare a platformei SaaS Valloreg pentru administrarea flotelor.',
  blocks: [
    {
      k: 'p',
      t: 'Prin utilizarea serviciului Valloreg acceptați următorii termeni. Vă rugăm să îi citiți cu atenție înainte de utilizare.',
    },
    { k: 'h', t: '1. Furnizorul și serviciul' },
    { k: 'ul', items: companyIdentityItems() },
    {
      k: 'p',
      t: 'Valloreg este un serviciu software de tip SaaS, destinat profesioniștilor (B2B), care procesează documente și date despre vehicule încărcate de utilizator, cu ajutorul OCR și al inteligenței artificiale, pentru a construi un istoric digital de service. Serviciul este furnizat conform condițiilor planului de abonament în vigoare.',
    },
    { k: 'h', t: '2. Contul și responsabilitatea' },
    {
      k: 'p',
      t: 'Sunteți responsabil pentru păstrarea în siguranță a datelor de acces și pentru activitățile desfășurate prin contul dumneavoastră. Accesul este controlat prin roluri (OWNER, FLEET_MANAGER, ADMIN, ACCOUNTANT, VIEWER). Serviciul poate fi utilizat exclusiv în scopuri legale.',
    },
    { k: 'h', t: '3. Conținut și date' },
    {
      k: 'p',
      t: 'Conținutul încărcat de dumneavoastră rămâne proprietatea dumneavoastră. Sunteți responsabil să dețineți dreptul de a încărca și prelucra datele. Datele fiecărei companii sunt complet izolate (izolare pe tenant). Operatorul platformei nu vede, în mod implicit, conținutul facturilor și documentelor.',
    },
    { k: 'h', t: '4. Rezultatele AI/OCR' },
    {
      k: 'p',
      t: 'Rezultatul prelucrării bazate pe AI/OCR are caracter informativ și este propus spre verificare. Recomandăm verificarea datelor importante înainte de utilizarea lor în scopuri contabile, fiscale sau de mentenanță.',
    },
    { k: 'h', t: '5. Natura serviciului și răspunderea' },
    {
      k: 'p',
      t: 'Valloreg pune la dispoziție EXCLUSIV un instrument software de facilitare și transparență (un „unealtă") pentru organizarea documentelor și a istoricului de service. Furnizorul își asumă răspunderea exclusiv pentru FUNCȚIONAREA tehnică a serviciului (disponibilitatea și operarea platformei conform planului de abonament), pe bază de best-effort.',
    },
    {
      k: 'p',
      t: 'Orice altă responsabilitate revine utilizatorului: corectitudinea, legalitatea și utilizarea datelor încărcate; verificarea rezultatelor generate de OCR/AI înainte de utilizarea lor (contabilă, fiscală, de mentenanță sau de orice altă natură); deciziile luate pe baza informațiilor din platformă; respectarea obligațiilor proprii (fiscale, de protecția datelor în calitate de operator al propriilor date, de conformitate a flotei etc.).',
    },
    {
      k: 'p',
      t: 'Serviciul este furnizat „ca atare" și „așa cum este disponibil", fără garanții de potrivire pentru un anumit scop. În măsura maximă permisă de lege, în relația B2B (între profesioniști), furnizorul nu acordă despăgubiri și nu răspunde pentru daune (directe sau indirecte), pierderi de date, de profit, de oportunitate sau întreruperi, rezultate din utilizarea ori imposibilitatea de utilizare a serviciului. Utilizatorul folosește serviciul pe propriul risc.',
    },
    {
      k: 'note',
      t: '[DE VERIFICAT JURIDIC – esențial] Limitarea/exonerarea de răspundere are LIMITE legale care nu pot fi înlăturate contractual nici în B2B: răspunderea pentru dol și culpă gravă, pentru vătămare corporală/deces, garanțiile imperative și răspunderea operatorului față de persoanele vizate conform GDPR (art. 82) nu pot fi excluse. Formularea „nu despăgubim pe nimeni cu nimic" NU este pe deplin opozabilă; avocatul trebuie să redacteze plafonul de răspundere (de regulă limitat la suma abonamentului) și excepțiile obligatorii. De asemenea, dacă serviciul devine accesibil persoanelor fizice (PFA/consumatori), se aplică reguli de protecția consumatorului.',
    },
    {
      k: 'note',
      t: '[DE COMPLETAT de avocat] Clauze contractuale B2B suplimentare: prețuri și plată, durata și încetarea, perioada de probă, politica de rambursare, proprietatea intelectuală, forța majoră, legea aplicabilă și instanța competentă, modalitatea de modificare a termenilor.',
    },
    { k: 'h', t: '6. Contact' },
    { k: 'p', t: `Pentru întrebări legate de acești termeni: ${COMPANY.email}.` },
  ],
};

const cookies: LegalDoc = {
  slug: 'cookie',
  category: 'public',
  title: 'Politica de Cookie-uri',
  subtitle: 'Mecanisme tehnice și consimțământ',
  updated: '25 iunie 2026',
  reviewRequired: true,
  summary:
    'Ce mecanisme tehnice (cookie-uri, stocare locală) utilizează Valloreg și cum se gestionează consimțământul.',
  blocks: [
    {
      k: 'p',
      t: 'Această politică explică mecanismele tehnice utilizate de Valloreg (cookie-uri, localStorage și tehnologii similare) și modul de gestionare a consimțământului, conform Directivei ePrivacy și GDPR.',
    },
    { k: 'h', t: '1. Categorii utilizate' },
    {
      k: 'table',
      head: ['Categorie', 'Scop', 'Temei', 'Necesită consimțământ'],
      rows: [
        ['Strict necesare', 'Autentificare (token JWT), securitate, preferința de limbă, păstrarea sesiunii', 'Interes legitim / executarea contractului', 'Nu'],
        ['Funcționale / preferințe', 'Reținerea alegerilor (de ex. preferințe de consimțământ)', 'Consimțământ', 'Da'],
        ['Notificări push', 'Trimiterea mementourilor către browser, dacă utilizatorul activează push', 'Consimțământ (Art. 6(1)(a))', 'Da'],
      ],
    },
    {
      k: 'note',
      t: '[DE VERIFICAT JURIDIC] Platforma nu integrează, conform implementării actuale, instrumente de analiză terță parte sau cookie-uri de marketing/urmărire. Dacă vor fi adăugate (de ex. analytics), tabelul și banner-ul de consimțământ trebuie actualizate corespunzător.',
    },
    { k: 'h', t: '2. Gestionarea consimțământului' },
    {
      k: 'p',
      t: 'La prima vizită apare un panou de consimțământ prin care puteți accepta toate categoriile sau doar pe cele strict necesare. Categoriile strict necesare nu pot fi dezactivate, deoarece sunt esențiale pentru funcționarea serviciului. Alegerea este memorată local și poate fi modificată oricând revenind la acest panou.',
    },
    { k: 'h', t: '3. Cum controlați cookie-urile' },
    {
      k: 'p',
      t: 'Puteți șterge sau bloca cookie-urile din setările browserului. Blocarea categoriilor strict necesare poate afecta funcționarea serviciului (de ex. autentificarea).',
    },
    { k: 'p', t: `Întrebări: ${COMPANY.email}.` },
  ],
};

export const PUBLIC_DOCS: LegalDoc[] = [privacy, terms, cookies];
