'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  authApi,
  storeAuth,
  resolveErrorKey,
  errorDebugSuffix,
  isTwoFactorChallenge,
} from '@/lib/api';
import { isValidEmail, isNonEmpty } from '@/lib/validation';

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const t = useTranslations('auth.login');
  const tv = useTranslations('auth.validation');
  const te = useTranslations('auth.errors');
  const t2 = useTranslations('auth.twoFactor');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 2FA második lépés: ha a login challenge-et ad vissza.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!isNonEmpty(email)) next.email = tv('required');
    else if (!isValidEmail(email)) next.email = tv('emailInvalid');
    if (!isNonEmpty(password)) next.password = tv('required');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await authApi.login({
        email: email.trim(),
        password,
        rememberMe,
      });
      if (isTwoFactorChallenge(res)) {
        // 2FA aktív: átváltunk a kód-bekérő lépésre.
        setSessionToken(res.sessionToken);
        return;
      }
      storeAuth(res, rememberMe);
      router.push('/dashboard');
    } catch (err) {
      // A nyers hibát a böngésző konzoljába is kiírjuk (státusz, URL) a könnyebb
      // diagnózishoz; a felhasználónak fordított üzenetet mutatunk.
      console.error('[auth] login failed', err);
      setFormError(te(resolveErrorKey(err)) + errorDebugSuffix(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!sessionToken) return;
    setSubmitting(true);
    try {
      const res = await authApi.verifyTwoFactorLogin(sessionToken, code.trim());
      storeAuth(res, rememberMe);
      router.push('/dashboard');
    } catch (err) {
      console.error('[auth] 2fa verify failed', err);
      setFormError(t2('invalid'));
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionToken) {
    return (
      <Card>
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-bold text-anthracite-900">
            {t2('title')}
          </h1>
          <p className="text-sm text-anthracite-500">{t2('subtitle')}</p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <form className="space-y-4" onSubmit={onSubmitCode} noValidate>
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            label={t2('codeLabel')}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" fullWidth size="lg" disabled={submitting}>
            {t2('verify')}
          </Button>
        </form>

        <button
          type="button"
          className="mt-6 w-full text-center text-sm font-medium text-primary-700 hover:text-primary-800"
          onClick={() => {
            setSessionToken(null);
            setCode('');
            setFormError(null);
          }}
        >
          {t2('back')}
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-anthracite-900">{t('title')}</h1>
        <p className="text-sm text-anthracite-500">{t('subtitle')}</p>
      </div>

      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          name="email"
          type="email"
          label={t('email')}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          name="password"
          type="password"
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <div className="-mt-2 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-anthracite-700">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-anthracite-300 text-primary-600 focus:ring-primary-500"
            />
            {t('rememberMe')}
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary-700 hover:text-primary-800"
          >
            {t('forgotPassword')}
          </Link>
        </div>
        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-anthracite-500">
        {t('noAccount')}{' '}
        <Link
          href="/register"
          className="font-semibold text-primary-700 hover:text-primary-800"
        >
          {t('registerLink')}
        </Link>
      </p>
    </Card>
  );
}
