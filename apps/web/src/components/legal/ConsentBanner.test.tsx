import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// next-intl mock: a fordítási kulcsot adja vissza nyersen (a useTranslations('consent')
// névteret figyelmen kívül hagyjuk, a kulcs maga lesz a szöveg).
vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

// A locale-tudatos Link helyett egyszerű <a>.
vi.mock('@/i18n/routing', () => ({
  Link: (p: { href: string; children: React.ReactNode }) => (
    <a href={p.href}>{p.children}</a>
  ),
}));

import { ConsentBanner } from './ConsentBanner';

const STORAGE_KEY = 'valloreg.consent';

describe('ConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tárolt döntés nélkül megjeleníti a bannert', () => {
    render(<ConsentBanner />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'acceptAll' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'rejectAll' }),
    ).toBeInTheDocument();
  });

  it('"acceptAll" kattintáskor elmenti a döntést és eltünteti a bannert', async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);
    await user.click(screen.getByRole('button', { name: 'acceptAll' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string);
    expect(stored).toMatchObject({
      v: 1,
      necessary: true,
      functional: true,
      marketing: true,
    });
    expect(typeof stored.ts).toBe('string');
  });

  it('"rejectAll" kattintáskor csak a szükségeseket menti és eltünteti a bannert', async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);
    await user.click(screen.getByRole('button', { name: 'rejectAll' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored).toMatchObject({
      v: 1,
      necessary: true,
      functional: false,
      marketing: false,
    });
  });

  it('a "preferences" megnyitja a beállítások panelt és a "saveChoices" menti az aktuális választást', async () => {
    const user = userEvent.setup();
    render(<ConsentBanner />);

    await user.click(screen.getByRole('button', { name: 'preferences' }));
    // a panel megnyílt: megjelenik a saveChoices gomb
    expect(
      screen.getByRole('button', { name: 'saveChoices' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'saveChoices' }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    // alapból functional=true, marketing=false a state szerint
    expect(stored).toMatchObject({
      v: 1,
      necessary: true,
      functional: true,
      marketing: false,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('már tárolt, aktuális verziójú döntés esetén nem jelenik meg a banner', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        necessary: true,
        functional: true,
        marketing: false,
        ts: new Date().toISOString(),
      }),
    );
    render(<ConsentBanner />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('eltérő (régi) verziójú tárolt döntés esetén újra megjelenik a banner', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 0, necessary: true, functional: false, marketing: false }),
    );
    render(<ConsentBanner />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
