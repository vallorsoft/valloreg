# Biztonsági szabályzat (Security Policy)

> **Verzió:** 1.0 · **Hatályos:** 2026-06-27
> Ez a szabályzat a Platform **tényleges** biztonsági intézkedéseit írja le (audit
> alapján), és megkülönbözteti a **megvalósított** és a **tervezett/hiányzó**
> kontrollokat. A GDPR 32. cikkéhez igazítva.

## 1. Hitelesítés és munkamenet

- Jelszó-tárolás: **`argon2`** hash (nincs plaintext).
- Munkamenet: **JWT** access token (15 perc) + refresh token (14 nap), amely
  **rotálódik**, SHA-256-tal **hash-elve** tárolódik, és **visszavonható**
  (kijelentkezéskor és jelszó-visszaállításkor minden token visszavonásra kerül).
- Jelszó-visszaállítás: egyszer használatos, **1 óra** lejáratú, hash-elt token.
- E-mail meghívó alapú felhasználó-felvétel, lejáró tokennel.

## 2. Hozzáférés-szabályozás

- **RBAC** szerepkörök: `OWNER`, `ADMIN`, `FLEET_MANAGER`, `ACCOUNTANT`, `VIEWER`.
- **Multi-tenant izoláció:** minden üzleti rekord `tenantId`-vel; a Prisma
  kiterjesztés automatikusan szűr, és **fail-closed** (tenant kontextus nélkül
  hibát dob). A tagság (membership) guarddal ellenőrzött.
- A platform-üzemeltető (**Super Admin**) **alapból nem látja** a bérlők üzleti
  tartalmát; csak rendszeradat, statisztika, előfizetés, hiba, audit látható számára.

## 3. Hálózati és alkalmazás-szintű védelem

- **TLS** mindenhol (HTTPS); adatbázis `sslmode=require`.
- **`helmet`** biztonsági fejlécek; **CORS** allowlist (`CORS_ORIGINS`).
- Bemenet-validáció **`class-validator`** whitelist móddal.
- Fájlfeltöltés: MIME- és méret-ellenőrzés (PDF/JPG/PNG, max 25 MB).
- Objektumtár: **presigned URL** (15 perc), tenant-prefixes kulcsok, fájlnév-tisztítás.

## 4. Naplózás és elszámoltathatóság

- **Audit napló** minden érzékeny műveletről: ki (user), melyik cég (tenant),
  művelet, erőforrás, IP, időbélyeg.
- A naplóhoz a cég `OWNER`/`ADMIN` szerepköre fér hozzá; a hibakezelés úgy
  készült, hogy a naplózás hibája ne akassza meg az üzleti műveletet.

## 5. Adattárolás és titkosítás

- Adatbázis: Neon (AWS `eu-central-1`, EU) – szolgáltatói szintű titkosítás
  nyugalmi állapotban.
- Dokumentumok: Cloudflare R2 (S3-kompatibilis) – szolgáltatói titkosítás.
- 📌 **Alkalmazás-szintű mezőtitkosítás nincs aktívan** (`INTEGRATION_ENC_KEY`
  konfigurálható, de jelenleg nincs használatban).

## 6. Adattakarékosság

- A forgalmiból kiolvasott **tulajdonosnév nem kerül tárolásra**.
- Benchmark: anonim, aggregált, **k-anonimitási küszöb** (≥5 cég és ≥20 jármű) +
  opt-in.

## 7. Ismert hiányosságok és teendők (őszinte állapot)

> ⚠️ Ezeket a megfelelőség élesítése előtt kezelni kell.

| Terület | Állapot | Teendő |
|---|---|---|
| 🔴 Élő DB-jelszó a `.env.example`-ben (git) | sérülékeny | **Azonnali** kulcsrotáció + git-előzmény tisztítás |
| Fiók-/adat-törlés (GDPR 17.) | hiányzik | Törlési folyamat + S3-objektum törlés |
| Adat-export (GDPR 20.) | hiányzik | Gépi export (JSON/CSV) |
| Rate limiting | hiányzik | Hitelesítési végpontok korlátozása (brute-force ellen) |
| 2FA | nincs implementálva | Kétlépcsős hitelesítés bevezetése |
| Token tárolás (`localStorage`) | XSS-kockázat | httpOnly cookie-ra váltás |
| Alkalmazás-szintű mentés | nincs dokumentálva | Mentési/visszaállítási eljárás kidolgozása |
| `extractionRaw` / fájlnév | személyes adatot tárolhat | Minimalizálás/áttekintés |

> 📌 **MEGJEGYZÉS:** A `docs/SECURITY.md` rate limitinget és 2FA-t említ; ezek a kód
> jelenlegi állapotában **nem** aktívak. A dokumentációt és a valóságot össze kell hangolni.

## 8. Incidenskezelés

Adatvédelmi incidens esetén az Üzemeltető a GDPR 33–34. cikke szerint jár el (72
órás bejelentés a hatósághoz, szükség esetén az érintettek értesítése), és
adatfeldolgozóként **indokolatlan késedelem nélkül** értesíti az érintett Ügyfelet.
Bejelentés: vallorsoft@gmail.com.

## 9. Felülvizsgálat

E szabályzatot az Üzemeltető rendszeresen, illetve lényeges változáskor felülvizsgálja.
