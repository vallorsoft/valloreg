import { test, expect } from '@playwright/test';

/**
 * Auth oldalak KLIENSOLDALI E2E tesztjei + consent banner.
 *
 * Backend NÉLKÜL futnak: kizárólag a hálózati hívás ELŐTTI kliens-validációt és
 * a navigációt teszteljük (a tényleges login/register submit backendet hívna).
 *
 * A `ConsentBanner` a locale layoutban minden oldalon megjelenik (fixed, alul),
 * ezért az auth-teszteknél előre "elfogadottra" állítjuk a localStorage-t, hogy
 * ne fedje a gombokat. A consent-specifikus teszt friss kontextusban fut.
 */

const CONSENT_KEY = 'valloreg.consent';

// Előre beállított, érvényes (v=1) consent – így a banner NEM jelenik meg, és
// nem zavarja az auth űrlapok interakcióját.
const ACCEPTED_CONSENT = JSON.stringify({
  v: 1,
  necessary: true,
  functional: true,
  marketing: true,
  ts: '2026-01-01T00:00:00.000Z',
});

test.describe('auth – kliensoldali validáció és navigáció', () => {
  test.beforeEach(async ({ page }) => {
    // A consent bannert elnyomjuk, hogy ne fedje az űrlapot.
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [CONSENT_KEY, ACCEPTED_CONSENT],
    );
  });

  test('/hu/login: üres submit → validációs hibák, nem navigál el', async ({
    page,
  }) => {
    await page.goto('/hu/login');

    // Az oldal betölt: a cím látható.
    await expect(
      page.getByRole('heading', { name: 'Bejelentkezés' }),
    ).toBeVisible();

    // Üres űrlap beküldése.
    await page.getByRole('button', { name: 'Bejelentkezés' }).click();

    // Mindkét mezőre megjelenik a "kötelező" hiba (role="alert").
    const alerts = page.getByRole('alert');
    await expect(alerts.filter({ hasText: 'Ez a mező kötelező.' })).toHaveCount(
      2,
    );

    // Nem navigált el – továbbra is a login oldalon vagyunk.
    await expect(page).toHaveURL(/\/hu\/login$/);
  });

  test('/hu/login: érvénytelen email → email-hiba', async ({ page }) => {
    await page.goto('/hu/login');

    await page.getByLabel('E-mail').fill('nem-egy-email');
    await page.getByLabel('Jelszó').fill('valami-jelszo');
    await page.getByRole('button', { name: 'Bejelentkezés' }).click();

    await expect(
      page.getByText('Adjon meg érvényes e-mail címet.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/hu\/login$/);
  });

  test('/hu/login: navigációs linkek (regisztráció, elfelejtett jelszó)', async ({
    page,
  }) => {
    await page.goto('/hu/login');

    // Elfelejtett jelszó link.
    await page.getByRole('link', { name: 'Elfelejtett jelszó?' }).click();
    await expect(page).toHaveURL(/\/hu\/forgot-password$/);

    // Vissza a loginra, majd a regisztráció link.
    await page.goto('/hu/login');
    await page.getByRole('link', { name: 'Regisztráljon' }).click();
    await expect(page).toHaveURL(/\/hu\/register$/);
  });

  test('/hu/register: üres submit → több mező validációs hibája', async ({
    page,
  }) => {
    await page.goto('/hu/register');

    await expect(
      page.getByRole('heading', { name: 'Regisztráció' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Fiók létrehozása' }).click();

    // Az összes mező kötelező → 6 darab "kötelező" hiba jelenik meg.
    await expect(
      page.getByRole('alert').filter({ hasText: 'Ez a mező kötelező.' }),
    ).toHaveCount(6);

    await expect(page).toHaveURL(/\/hu\/register$/);
  });

  test('/hu/register: érvénytelen mezők → célzott validációs hibák', async ({
    page,
  }) => {
    await page.goto('/hu/register');

    // Kitöltjük, de email/adószám/telefon/jelszó érvénytelen.
    await page.getByLabel('Cégnév').fill('Teszt Kft.');
    await page.getByLabel('Adószám').fill('123'); // < 6 számjegy
    await page.getByLabel('Kapcsolattartó neve').fill('Teszt Elek');
    await page.getByLabel('E-mail').fill('rossz-email');
    await page.getByLabel('Telefonszám').fill('12'); // túl rövid
    await page.getByLabel('Jelszó').fill('rovid'); // < 8 karakter

    await page.getByRole('button', { name: 'Fiók létrehozása' }).click();

    await expect(
      page.getByText('Adjon meg érvényes adószámot.'),
    ).toBeVisible();
    await expect(
      page.getByText('Adjon meg érvényes e-mail címet.'),
    ).toBeVisible();
    await expect(
      page.getByText('Adjon meg érvényes telefonszámot.'),
    ).toBeVisible();
    await expect(
      page.getByText('A jelszónak legalább 8 karakterből kell állnia.'),
    ).toBeVisible();

    await expect(page).toHaveURL(/\/hu\/register$/);
  });

  test('/hu/forgot-password: üres/érvénytelen submit → email-hiba', async ({
    page,
  }) => {
    await page.goto('/hu/forgot-password');

    await expect(
      page.getByRole('heading', { name: 'Elfelejtett jelszó' }),
    ).toBeVisible();

    // Üres submit → kötelező.
    await page
      .getByRole('button', { name: 'Visszaállító link küldése' })
      .click();
    await expect(page.getByText('Ez a mező kötelező.')).toBeVisible();

    // Érvénytelen email → email-hiba.
    await page.getByLabel('E-mail').fill('nem-email');
    await page
      .getByRole('button', { name: 'Visszaállító link küldése' })
      .click();
    await expect(
      page.getByText('Adjon meg érvényes e-mail címet.'),
    ).toBeVisible();

    await expect(page).toHaveURL(/\/hu\/forgot-password$/);
  });
});

test.describe('consent banner', () => {
  test('friss kontextusban megjelenik; elfogadásra eltűnik és localStorage-be ír', async ({
    page,
  }) => {
    // Friss kontextus: a consent kulcsot kitöröljük még a render előtt.
    await page.addInitScript((key) => {
      window.localStorage.removeItem(key);
    }, CONSENT_KEY);

    await page.goto('/hu/login');

    // A banner (role="dialog") megjelenik.
    const banner = page.getByRole('dialog', { name: 'Adatvédelem és sütik' });
    await expect(banner).toBeVisible();

    // Kezdetben nincs eltárolt consent.
    const before = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CONSENT_KEY,
    );
    expect(before).toBeNull();

    // "Összes elfogadása" → a banner eltűnik.
    await banner.getByRole('button', { name: 'Összes elfogadása' }).click();
    await expect(banner).toBeHidden();

    // A localStorage beállítódik, helyes verzióval/kategóriákkal.
    const raw = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CONSENT_KEY,
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      v: number;
      necessary: boolean;
      functional: boolean;
      marketing: boolean;
      ts: string;
    };
    expect(parsed.v).toBe(1);
    expect(parsed.necessary).toBe(true);
    expect(parsed.functional).toBe(true);
    expect(parsed.marketing).toBe(true);
    expect(typeof parsed.ts).toBe('string');
  });

  test('érvényes consent esetén a banner nem jelenik meg', async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [CONSENT_KEY, ACCEPTED_CONSENT],
    );

    await page.goto('/hu/login');

    // A login oldal él, de banner nincs.
    await expect(
      page.getByRole('heading', { name: 'Bejelentkezés' }),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Adatvédelem és sütik' }),
    ).toHaveCount(0);
  });
});
