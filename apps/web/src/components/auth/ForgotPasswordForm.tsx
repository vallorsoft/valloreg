'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authApi, resolveErrorKey, errorDebugSuffix } from '@/lib/api';
import { isValidEmail, isNonEmpty } from '@/lib/validation';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const tv = useTranslations('auth.validation');
  const te = useTranslations('auth.errors');
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): boolean {
    if (!isNonEmpty(email)) {
      setEmailError(tv('required'));
      return false;
    }
    if (!isValidEmail(email)) {
      setEmailError(tv('emailInvalid'));
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim(), locale);
      setDone(true);
    } catch (err) {
      // A backend mindig 200-at ad (nem árul el fiók-létezést); ide csak hálózati
      // vagy szerverhiba esetén jutunk.
      console.error('[auth] forgot-password failed', err);
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
        <div
          role="status"
          className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          {t('success')}
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
              name="email"
              type="email"
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
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
