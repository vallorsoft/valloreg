# Cookie- és tárolási szabályzat

> **Verzió:** 1.0 · **Hatályos:** 2026-06-27 ·
> **Utolsó módosítás:** 2026-06-24
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS AJÁNLOTT.** Ez a szabályzat a tényleges frontend-
> implementáció auditja alapján készült.

## 1. Bevezetés

Ez a szabályzat azt írja le, milyen **sütiket, helyi tárolást és hasonló
technológiákat** használ a Valloreg Platform. A vizsgálat eredménye: a Platform
**nem használ** analitikai, profilalkotó vagy marketing célú sütit/követőt, és nem
tölt be harmadik féltől származó követő szkriptet.

## 2. Amit a Platform NEM használ

- ❌ Google Analytics, Google Tag Manager
- ❌ Meta (Facebook) Pixel, hirdetési követők
- ❌ Sentry, Hotjar, PostHog, Plausible, Segment, Mixpanel
- ❌ Harmadik féltől származó betűtípus (pl. Google Fonts) – **rendszer-betűtípust**
  használ, így nincs külső betöltés és ujjlenyomatozás
- ❌ Külső CDN-ről betöltött szkript vagy kép – minden ikon helyi

## 3. Amit a Platform használ (feltétlenül szükséges)

A bejelentkezett alkalmazás a böngésző **`localStorage`** tárát használja a
működéshez feltétlenül szükséges adatokhoz. Ezek **nem klasszikus sütik**, de az
átláthatóság érdekében itt felsoroljuk:

| Kulcs | Típus | Cél | Élettartam | Hozzájárulás-köteles? |
|---|---|---|---|---|
| `valloreg.accessToken` | localStorage | bejelentkezés (JWT access token) | kijelentkezésig / törlésig | nem (feltétlenül szükséges) |
| `valloreg.refreshToken` | localStorage | munkamenet megújítása (JWT refresh) | kijelentkezésig / törlésig | nem (feltétlenül szükséges) |
| `valloreg.activeTenantId` | localStorage | aktív cég kiválasztása | kijelentkezésig / törlésig | nem (funkcionális, szükséges) |

> 📌 **MEGJEGYZÉS (biztonság):** A tokenek `localStorage`-ban tárolása XSS-kockázatot
> hordoz; a fejlesztői terv szerint ezek később httpOnly cookie-ba kerülnek. Ez a
> változás e szabályzat frissítését igényli majd.

## 4. Service worker és PWA

A Platform **progresszív webalkalmazás (PWA)**: telepíthető, és service worker
biztosítja az offline alap-működést, valamint a **web push** értesítéseket. A
service worker a felület statikus elemeit gyorsítótárazza; ez nem szolgál
követésre.

## 5. Web push értesítések (hozzájárulás-köteles)

Ha Ön engedélyezi az értesítéseket, a böngésző push-szolgáltatása (pl. Google FCM,
Mozilla, Apple) közreműködik a kézbesítésben. Ehhez a Platform eltárolja a push-
**végpontot**, a titkosító kulcsokat (`p256dh`, `auth`) és opcionálisan a
**böngésző-azonosítót (User-Agent)**. Ez **kifejezett hozzájáruláson** alapul
(böngésző engedélykérés), és bármikor visszavonható (leiratkozás / böngésző-beállítás).

## 6. Jogalap

Mivel a Platform csak a működéshez **feltétlenül szükséges** technikai tárolást
használ, az ePrivacy irányelv szerint ehhez **előzetes hozzájárulás nem szükséges**,
de tájékoztatás igen (ezt e dokumentum nyújtja). A web push **hozzájáruláshoz kötött**.

## 7. Hogyan kezelheti?

- A `localStorage` adatait a böngésző beállításaiból törölheti; a kijelentkezés a
  token-kulcsokat eltávolítja.
- A web push értesítéseket a Platformon vagy a böngésző beállításaiban kapcsolhatja ki.

## 8. Módosítás

Ha a Platform a jövőben analitikai vagy egyéb, hozzájárulás-köteles technológiát
vezet be, e szabályzat frissül, és **hozzájárulás-kezelő sáv (banner)** jelenik meg
a szükséges előzetes hozzájárulással (lásd `04_Cookie_Banner_Szovegek.md`).
