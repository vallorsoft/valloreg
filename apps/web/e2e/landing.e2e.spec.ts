import { test, expect } from '@playwright/test';

/**
 * E2E a PUBLIKUS landing oldalra (backend nélkül működik).
 *
 * Robusztus selectorok: szerep/heading/landmark + a hu.json-ból vett valódi
 * (rész)stringek. A forráshoz NEM nyúlunk – a tesztet a tényleges DOM-hoz
 * igazítjuk.
 */

// A hu.json-ból átemelt valódi szövegek (rész)stringjei – nem törékeny egész.
const HU = {
  heroHeadline: 'A szervizszámlák feldolgozása automatikusan',
  ctaPrimary: 'Próbálja ki ingyen',
  navLogin: 'Bejelentkezés',
  navRegister: 'Regisztráció',
  featuresTitle: 'Minden, ami a flotta szervizéhez kell',
  pricingTitle: 'Átlátható árazás',
  faqTitle: 'Gyakori kérdések',
  footerPrivacy: 'Adatvédelem',
} as const;

// A ro.json-ból átemelt valódi szöveg – a nyelvváltás ellenőrzéséhez.
const RO = {
  heroHeadline: 'Procesați facturile de service automat',
} as const;

test.describe('Publikus landing oldal', () => {
  test('mindhárom locale (/hu, /ro, /en) 200-zal betölt és helyes az <html lang>', async ({
    page,
  }) => {
    for (const locale of ['hu', 'ro', 'en'] as const) {
      const response = await page.goto(`/${locale}`);
      expect(response, `${locale}: van HTTP válasz`).not.toBeNull();
      expect(response!.status(), `${locale}: HTTP 200`).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }
  });

  test('/hu: van h1, látható a hero, és van CTA link a regisztrációra', async ({ page }) => {
    await page.goto('/hu');

    // Pontosan egy fő h1 (a hero headline), és látható.
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(HU.heroHeadline);

    // Hero CTA link a regisztrációra (a Hero-ban a "Próbálja ki ingyen" /register).
    const heroCta = page.getByRole('link', { name: HU.ctaPrimary });
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute('href', /\/register$/);

    // A fejlécben bejelentkezés + regisztráció link is van.
    await expect(page.getByRole('link', { name: HU.navRegister }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: HU.navLogin }).first()).toBeVisible();
  });

  test('/hu: a fő szekciók (Funkciók, Árazás, GYIK) jelen vannak', async ({ page }) => {
    await page.goto('/hu');

    await expect(page.getByRole('heading', { name: HU.featuresTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: HU.pricingTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: HU.faqTitle })).toBeVisible();
  });

  test('/hu: a marketing lábléc jogi (legal) linkjei láthatók', async ({ page }) => {
    await page.goto('/hu');

    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();

    // Adatvédelmi link a láblécben, /legal alá mutat.
    const privacy = footer.getByRole('link', { name: HU.footerPrivacy });
    await expect(privacy).toBeVisible();
    await expect(privacy).toHaveAttribute('href', /\/legal\//);
  });

  test('nyelvváltó: /hu-ról ro-ra váltva az URL /ro lesz és a tartalom ro', async ({ page }) => {
    await page.goto('/hu');

    // A LanguageSwitcher egy role="group", a gombok aria-label-jük: hu/ro/en.
    const switcher = page.getByRole('group', { name: /Nyelv|Limb|Language/i }).first();
    await expect(switcher).toBeVisible();

    // A "ro" gomb felirata maga a kód (uppercase a CSS-ben), aria-label = "Román".
    const roButton = switcher.getByRole('button', { name: 'Román' });
    await expect(roButton).toBeVisible();
    await roButton.click();

    await expect(page).toHaveURL(/\/ro(\b|\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(RO.heroHeadline);
  });

  test('közvetlen /ro navigáció: a hero ro nyelvű', async ({ page }) => {
    await page.goto('/ro');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByText(RO.heroHeadline)).toBeVisible();
  });
});
