'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authApi, resolveErrorKey, errorDebugSuffix } from '@/lib/api';
import { isValidPassword, isNonEmpty } from '@/lib/validation';

// A "Bejelentkezés" gomb a sikeres állapotban Link-ként renderelődik (a/button
// egymásba ágyazás elkerülésére), de a form submit gombja a Button komponens.

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const tv = useTranslations('auth.validation');
  const te = useTranslations('auth.errors');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!isNonEmpty(password)) next.password = tv('required');
    else if (!isValidPassword(password)) next.password = tv('passwordTooShort');
    if (!isNonEmpty(confirmPassword)) next.confirmPassword = tv('required');
    else if (confirmPassword !== password)
      next.confirmPassword = tv('passwordsMismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      console.error('[auth] reset-password failed', err);
      setFormError(te(resolveErrorKey(err)) + errorDebugSuffix(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="mb-6 space-y-1 text-center">
        <h1 className="text-2xl font-bold text-anthracite-900">{t('title')}</h1>
        <p className="text-sm text-anthracite-500">{t('subtitle')}</p>
      </div>

      {done ? (
        <>
          <div
            role="status"
            className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {t('success')}
          </div>
          <Link
            href="/login"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-7 text-base font-semibold text-white transition-colors hover:bg-primary-700 active:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {t('goToLogin')}
          </Link>
        </>
      ) : !token ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {t('invalidLink')}
        </div>
      ) : (
        <>
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
              name="password"
              type="password"
              label={t('password')}
              placeholder={t('passwordPlaceholder')}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <Input
              name="confirmPassword"
              type="password"
              label={t('confirmPassword')}
              placeholder={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
            />
            <Button type="submit" fullWidth size="lg" disabled={submitting}>
              {t('submit')}
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-anthracite-500">
        <Link
          href="/login"
          className="font-semibold text-primary-700 hover:text-primary-800"
        >
          {t('backToLogin')}
        </Link>
      </p>
    </Card>
  );
}
