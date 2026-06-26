import { test, expect } from '@playwright/test';

/**
 * E2E az ÚTVONAL-VÉDELEMRE, a locale-routingra és a publikus jogi (legal)
 * oldalakra – backend NÉLKÜL.
 *
 * Felderített tényleges viselkedés (a forráshoz NEM nyúlunk):
 *
 * 1) AUTH-VÉDELEM (KLIENSOLDALI):
 *    A `(app)` route group layout-ja az `AppShell` komponensbe csomagol
 *    (`src/components/app/AppShell.tsx`). Az AppShell egy `useEffect`-ben
 *    `isAuthenticated()`-et hív (`src/lib/auth.ts` → localStorage
 *    `valloreg.accessToken`), és ha NINCS token, `router.replace(
 *    `/${locale}/login`)`-nal átirányít. Token nélkül tehát a `/hu/dashboard`,
 *    `/hu/vehicles` stb. NEM marad a védett oldalon → a `/hu/login`-ra jut.
 *    A redirect ASZINKRON (kliensoldali useEffect), ezért `toHaveURL` timeouttal
 *    várunk rá. Minden böngészőkontextus friss → üres a localStorage.
 *
 * 2) LOCALE-ROUTING (next-intl, localePrefix: 'always'):
 *    A `src/middleware.ts` next-intl middleware-t használ; a prefix nélküli `/`
 *    az alapnyelvre (`/hu`) irányít, a `/ro` és `/en` is elérhető (HTTP 200,
 *    helyes <html lang>).
 *
 * 3) LEGAL (publikus):
 *    `src/app/[locale]/legal/page.tsx` (hub) és `legal/[slug]/page.tsx`. A
 *    slugok a `src/lib/legal/`-ból jönnek; az első publikus slug:
 *    `confidentialitate`. Token nélkül is betöltenek (publikus marketing
 *    oldalak), van h1 heading.
 *
 * 4) 404: ismeretlen útvonal → `src/app/[locale]/not-found.tsx`, ami egy
 *    nyelvfüggetlen "404" szöveget jelenít meg.
 */

// Az első PUBLIKUS jogi dokumentum slugja (src/lib/legal/content/public.ts).
const LEGAL_SLUG = 'confidentialitate';

// A védett (app) útvonalak, amiket token nélkül login-ra kell terelni.
const PROTECTED_PATHS = ['/hu/dashboard', '/hu/vehicles'] as const;

test.describe('Útvonal-védelem (kliensoldali auth guard)', () => {
  for (const path of PROTECTED_PATHS) {
    test(`token nélkül ${path} a /hu/login-ra irányít`, async ({ page }) => {
      // Friss kontextus → üres localStorage, nincs accessToken.
      await page.goto(path);

      // Az AppShell useEffect-je aszinkron redirectel a login-ra.
      await expect(page).toHaveURL(/\/hu\/login(\b|\/|\?|$)/, {
        timeout: 15_000,
      });
    });
  }

  test('a login oldal token nélkül betölt (a redirect célja létezik)', async ({
    page,
  }) => {
    const response = await page.goto('/hu/login');
    expect(response, 'van HTTP válasz').not.toBeNull();
    expect(response!.status(), 'HTTP 200').toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  });
});

test.describe('Locale-routing (next-intl)', () => {
  test('a prefix nélküli / locale-prefixre (next-intl negociáció) irányít', async ({
    page,
  }) => {
    // A next-intl middleware az Accept-Language alapján negociál; a prefix
    // nélküli / mindig egy locale-prefixre kerül (hu | ro | en). A pontos
    // célt a böngésző nyelve dönti el, ezért a megengedett halmazt ellenőrizzük.
    await page.goto('/');
    await expect(page).toHaveURL(/\/(hu|ro|en)(\b|\/|$)/);

    // A <html lang> az URL-ben landolt locale-lal egyezik.
    const url = new URL(page.url());
    const locale = url.pathname.split('/').filter(Boolean)[0] ?? '';
    expect(['hu', 'ro', 'en']).toContain(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  });

  test('explicit /hu navigáció a magyar alapnyelven marad', async ({ page }) => {
    await page.goto('/hu');
    await expect(page).toHaveURL(/\/hu(\b|\/|$)/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  });

  test('mindhárom locale (/hu, /ro, /en) 200-zal betölt, helyes <html lang>', async ({
    page,
  }) => {
    for (const locale of ['hu', 'ro', 'en'] as const) {
      const response = await page.goto(`/${locale}`);
      expect(response, `${locale}: van HTTP válasz`).not.toBeNull();
      expect(response!.status(), `${locale}: HTTP 200`).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    }
  });
});

test.describe('Publikus jogi (legal) oldalak', () => {
  test('a /hu/legal hub token nélkül betölt és van h1', async ({ page }) => {
    const response = await page.goto('/hu/legal');
    expect(response, 'van HTTP válasz').not.toBeNull();
    expect(response!.status(), 'HTTP 200').toBe(200);

    // Nem terelődik át login-ra (publikus oldal).
    await expect(page).toHaveURL(/\/hu\/legal(\b|\/|$)/);

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();

    // Legalább egy jogi dokumentumra mutató link a hubon.
    await expect(
      page.getByRole('link', { name: /.+/ }).filter({ hasText: /.+/ }).first(),
    ).toBeVisible();
    const docLink = page.locator(`a[href$="/legal/${LEGAL_SLUG}"]`).first();
    await expect(docLink).toBeVisible();
  });

  test(`a /hu/legal/${LEGAL_SLUG} dokumentum token nélkül betölt és van h1`, async ({
    page,
  }) => {
    const response = await page.goto(`/hu/legal/${LEGAL_SLUG}`);
    expect(response, 'van HTTP válasz').not.toBeNull();
    expect(response!.status(), 'HTTP 200').toBe(200);

    // Nem terelődik login-ra.
    await expect(page).toHaveURL(new RegExp(`/hu/legal/${LEGAL_SLUG}`));

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    await expect(h1).not.toBeEmpty();
  });

  test('a hubról egy dokumentumra navigálva a doc oldal nyílik meg', async ({
    page,
  }) => {
    await page.goto('/hu/legal');
    const docLink = page.locator(`a[href$="/legal/${LEGAL_SLUG}"]`).first();
    await expect(docLink).toBeVisible();
    await docLink.click();
    await expect(page).toHaveURL(new RegExp(`/hu/legal/${LEGAL_SLUG}`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('404 / ismeretlen útvonal', () => {
  test('nem létező útvonal a not-found oldalt adja (404 jelzés)', async ({
    page,
  }) => {
    await page.goto('/hu/nincs-ilyen-oldal');

    // A not-found.tsx egy nyelvfüggetlen "404" szöveget renderel.
    await expect(page.getByText('404')).toBeVisible();
  });
});
