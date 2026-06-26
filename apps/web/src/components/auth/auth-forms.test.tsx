import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Komponens-tesztek az auth űrlapokra (LoginForm, ForgotPasswordForm).
 *
 * A `useTranslations` mock a kulcsot adja vissza, ezért a labelek a fordítási
 * kulccsal egyenlők (pl. `t('email')` -> 'email'), és a label a `htmlFor` révén
 * az inputhoz kötődik -> `getByLabelText('email')` megbízhatóan működik.
 */

// --- Mockok ---

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'hu',
}));

vi.mock('@/i18n/routing', () => ({
  Link: (p: any) => <a href={p.href}>{p.children}</a>,
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const loginMock = vi.fn();
const verifyTwoFactorLoginMock = vi.fn();
const forgotPasswordMock = vi.fn();
const storeAuthMock = vi.fn();

vi.mock('@/lib/api', () => ({
  authApi: {
    login: (...args: any[]) => loginMock(...args),
    verifyTwoFactorLogin: (...args: any[]) => verifyTwoFactorLoginMock(...args),
    forgotPassword: (...args: any[]) => forgotPasswordMock(...args),
  },
  storeAuth: (...args: any[]) => storeAuthMock(...args),
  resolveErrorKey: (e: any) => e?.code ?? 'INTERNAL_ERROR',
  errorDebugSuffix: () => '',
  isTwoFactorChallenge: (r: any) => !!r?.twoFactorRequired,
}));

import { LoginForm } from './LoginForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginForm', () => {
  it('üres űrlap submitjekor validációs hibákat mutat, és nem hívja a login-t', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    // Email + jelszó: mindkettő üres -> 'required' hiba (FieldErrors logika).
    // A 'required' kulcs kétszer renderelődik (két mezőhöz).
    const requiredErrors = await screen.findAllByText('required');
    expect(requiredErrors).toHaveLength(2);

    expect(loginMock).not.toHaveBeenCalled();
  });

  it('érvénytelen email esetén emailInvalid hibát mutat, és nem hívja a login-t', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('email'), 'not-an-email');
    await user.type(screen.getByLabelText('password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('emailInvalid')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('érvényes adatokkal a login-t a megfelelő argumentumokkal hívja, majd storeAuth + router.push', async () => {
    const user = userEvent.setup();
    const authResult = { accessToken: 'a', refreshToken: 'r' };
    loginMock.mockResolvedValue(authResult);

    render(<LoginForm />);

    await user.type(screen.getByLabelText('email'), '  user@example.com  ');
    await user.type(screen.getByLabelText('password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1);
    });
    // Az email trim-elve, a jelszó nyersen.
    expect(loginMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    });

    await waitFor(() => {
      expect(storeAuthMock).toHaveBeenCalledWith(authResult);
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });

  it('2FA challenge esetén megjelenik a kód-mező, és nincs storeAuth/push', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      twoFactorRequired: true,
      sessionToken: 'session-xyz',
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText('email'), 'user@example.com');
    await user.type(screen.getByLabelText('password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    // A 2FA ág a 'codeLabel' kulcsú label-ű mezőt rendereli.
    expect(await screen.findByLabelText('codeLabel')).toBeInTheDocument();
    // A 2FA verify gomb is megjelenik.
    expect(screen.getByRole('button', { name: 'verify' })).toBeInTheDocument();

    expect(storeAuthMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('a kód megadása és submitje a verifyTwoFactorLogin-t hívja, majd storeAuth + push', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      twoFactorRequired: true,
      sessionToken: 'session-xyz',
    });
    const authResult = { accessToken: 'a', refreshToken: 'r' };
    verifyTwoFactorLoginMock.mockResolvedValue(authResult);

    render(<LoginForm />);

    await user.type(screen.getByLabelText('email'), 'user@example.com');
    await user.type(screen.getByLabelText('password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    const codeInput = await screen.findByLabelText('codeLabel');
    await user.type(codeInput, '123456');
    await user.click(screen.getByRole('button', { name: 'verify' }));

    await waitFor(() => {
      expect(verifyTwoFactorLoginMock).toHaveBeenCalledWith(
        'session-xyz',
        '123456',
      );
    });
    await waitFor(() => {
      expect(storeAuthMock).toHaveBeenCalledWith(authResult);
    });
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });

  it('login hiba esetén form-hibát mutat (resolveErrorKey kód), nincs push', async () => {
    const user = userEvent.setup();
    // A console.error elnyelése, hogy ne szennyezze a teszt-kimenetet.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loginMock.mockRejectedValue({ code: 'INVALID_CREDENTIALS' });

    render(<LoginForm />);

    await user.type(screen.getByLabelText('email'), 'user@example.com');
    await user.type(screen.getByLabelText('password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    // A formError egy role="alert" konténerben jelenik meg, a resolveErrorKey
    // által adott kóddal (te(...) mock a kulcsot adja vissza).
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('INVALID_CREDENTIALS');

    expect(storeAuthMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });
});

describe('ForgotPasswordForm', () => {
  it('üres email submitjekor required hibát mutat, és nem hívja a forgotPassword-öt', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('required')).toBeInTheDocument();
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  it('érvényes email esetén a forgotPassword-öt (trim + locale) hívja, és sikerüzenet jelenik meg', async () => {
    const user = userEvent.setup();
    forgotPasswordMock.mockResolvedValue(undefined);

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('email'), '  user@example.com  ');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(forgotPasswordMock).toHaveBeenCalledWith('user@example.com', 'hu');
    });

    // Sikeres válasz: a success üzenet role="status" konténerben.
    expect(await screen.findByRole('status')).toHaveTextContent('success');
  });

  it('hiba esetén form-hibát mutat (resolveErrorKey kód)', async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    forgotPasswordMock.mockRejectedValue({ code: 'INTERNAL_ERROR' });

    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('email'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('INTERNAL_ERROR');

    errSpy.mockRestore();
  });
});
