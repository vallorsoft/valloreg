# 16. Procedură de Revizuire a Accesului Utilizatorilor (User Access Review)

> **MARCAJ REVIZUIRE JURIDICĂ** — Procedură de revizuire periodică a accesului. De operaționalizat (frecvență, responsabili).

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Scop

Asigurarea că accesul utilizatorilor rămâne adecvat rolului și principiului privilegiului minim (vezi `15`).

## B. Domeniu

| Tip de acces | Sursă de date |
|---|---|
| Membri companie + roluri | `Membership` (tenantId, userId, role) |
| Invitații în așteptare | `Invitation` (expirare, `acceptedAt`) |
| Administratori de platformă | `User.isPlatformAdmin` |
| Accese suport active | `SupportAccess` (status, `expiresAt`) |

## C. Frecvență (propusă)

| Categorie | Frecvență |
|---|---|
| Roluri privilegiate (OWNER/ADMIN, SUPER_ADMIN) | Trimestrial |
| Utilizatori standard | Semestrial |
| Accese suport | La fiecare acordare + verificare lunară a celor active |
| Invitații expirate/neacceptate | Lunar (curățare) |

「⚖️ DE REVIZUIT — frecvențele de mai sus sunt recomandări.」

## D. Pași

1. **Extragere** listă acces (memberships, platform admins, support accesses active).
2. **Validare** cu managerii de companie / management Valloreg.
3. **Acțiune** — revocarea accesului inutil (ștergere membership, expirare/ revocare support).
4. **Documentare** — consemnarea revizuirii și a modificărilor; jurnalul de audit reține schimbările de rol.

## E. Indicatori de atenție

- Conturi `isPlatformAdmin=true` neașteptate;
- `SupportAccess` cu status `ACTIVE` și `expiresAt` în trecut (de verificat expirarea efectivă);
- Invitații vechi neacceptate;
- Roluri excesive față de necesitate.

---

## Ipoteze și limitări

1. Procedura presupune extragerea manuală a listelor (nu a fost identificat un raport automat dedicat de access review).
2. Revizuirea accesului la datele clienților revine clientului-operator pentru propriile companii.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
