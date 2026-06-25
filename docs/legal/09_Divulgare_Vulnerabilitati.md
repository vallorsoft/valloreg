# 9. Politică de Divulgare a Vulnerabilităților (Vulnerability Disclosure Policy)

> **MARCAJ REVIZUIRE JURIDICĂ** — Politică de tip „responsible disclosure". Datele de contact și domeniul de aplicare (scope) trebuie confirmate.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Angajament

VALLOR TEAM SRL apreciază cercetătorii de securitate care raportează responsabil vulnerabilitățile. Raportările făcute cu bună-credință, conform acestei politici, nu vor fi tratate ca acțiuni ostile.

## B. Domeniu de aplicare (scope)

| În scope | În afara scope |
|---|---|
| `https://valloreg-web.onrender.com` | Servicii terțe (Render, Neon, Cloudflare, Google, Brevo) |
| `https://valloreg-api.onrender.com` | Atacuri DoS/DDoS |
| Aplicația PWA Valloreg | Inginerie socială, phishing către angajați |

## C. Reguli (bună-credință)

1. **Fără afectarea disponibilității** serviciului (interzis DoS, degradare).
2. Fără accesarea, modificarea sau exfiltrarea datelor altor utilizatori; folosiți doar conturi de test proprii.
3. Respectarea confidențialității: nu divulgați public vulnerabilitatea înainte de remediere.
4. Fără exploatare dincolo de minimul necesar dovedirii problemei.

## D. Cum se raportează

- **Contact:** vallorsoft@gmail.com (subiect: „Security – Vulnerability Report"). 「⚖️ DE REVIZUIT — adresă dedicată recomandată (ex. security@…).」
- Includeți: descriere, pași de reproducere, impact, componenta afectată, dovezi.

## E. Procesul nostru

| Etapă | Termen-țintă |
|---|---|
| Confirmare de primire | 5 zile lucrătoare |
| Evaluare inițială și clasificare | 10 zile lucrătoare |
| Remediere | În funcție de severitate |
| Informare reporter despre rezolvare | După remediere |

Vulnerabilitățile confirmate care implică date personale declanșează `04`/`05`.

## F. Safe harbor

Cercetarea conformă cu această politică este considerată autorizată; nu vom iniția acțiuni legale pentru testarea de bună-credință, în limitele descrise.

---

## Ipoteze și limitări

1. Politica nu acoperă infrastructura furnizorilor terți (a se raporta direct acestora).
2. Nu există un program de „bug bounty" cu recompense, dacă nu se decide altfel.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
