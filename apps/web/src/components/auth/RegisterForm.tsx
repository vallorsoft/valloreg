'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { authApi, storeAuth, resolveErrorKey, errorDebugSuffix } from '@/lib/api';
import {
  isValidEmail,
  isNonEmpty,
  isValidPassword,
  isValidPhone,
  isValidTaxId,
} from '@/lib/validation';

interface RegisterFields {
  companyName: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  password: string;
}

type FieldErrors = Partial<Record<keyof RegisterFields, string>>;

const EMPTY: RegisterFields = {
  companyName: '',
  taxId: '',
  contactName: '',
  email: '',
  phone: '',
  password: '',
};

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const tv = useTranslations('auth.validation');
  const te = useTranslations('auth.errors');
  const router = useRouter();

  const [values, setValues] = useState<RegisterFields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof RegisterFields, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!isNonEmpty(values.companyName)) next.companyName = tv('required');
    if (!isNonEmpty(values.taxId)) next.taxId = tv('required');
    else if (!isValidTaxId(values.taxId)) next.taxId = tv('taxIdInvalid');
    if (!isNonEmpty(values.contactName)) next.contactName = tv('required');
    if (!isNonEmpty(values.email)) next.email = tv('required');
    else if (!isValidEmail(values.email)) next.email = tv('emailInvalid');
    if (!isNonEmpty(values.phone)) next.phone = tv('required');
    else if (!isValidPhone(values.phone)) next.phone = tv('phoneInvalid');
    if (!isNonEmpty(values.password)) next.password = tv('required');
    else if (!isValidPassword(values.password))
      next.password = tv('passwordTooShort');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await authApi.register({
        companyName: values.companyName.trim(),
        taxId: values.taxId.trim(),
        contactName: values.contactName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
      });
      storeAuth(res);
      router.push('/dashboard');
    } catch (err) {
      // A nyers hibát a böngésző konzoljába is kiírjuk (státusz, URL) a könnyebb
      // diagnózishoz; a felhasználónak fordított üzenetet mutatunk.
      console.error('[auth] register failed', err);
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
          name="companyName"
          label={t('companyName')}
          placeholder={t('companyNamePlaceholder')}
          autoComplete="organization"
          value={values.companyName}
          onChange={(e) => update('companyName', e.target.value)}
          error={errors.companyName}
        />
        <Input
          name="taxId"
          label={t('taxId')}
          placeholder={t('taxIdPlaceholder')}
          value={values.taxId}
          onChange={(e) => update('taxId', e.target.value)}
          error={errors.taxId}
        />
        <Input
          name="contactName"
          label={t('contactName')}
          placeholder={t('contactNamePlaceholder')}
          autoComplete="name"
          value={values.contactName}
          onChange={(e) => update('contactName', e.target.value)}
          error={errors.contactName}
        />
        <Input
          name="email"
          type="email"
          label={t('email')}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          error={errors.email}
        />
        <Input
          name="phone"
          type="tel"
          label={t('phone')}
          placeholder={t('phonePlaceholder')}
          autoComplete="tel"
          value={values.phone}
          onChange={(e) => update('phone', e.target.value)}
          error={errors.phone}
        />
        <Input
          name="password"
          type="password"
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          error={errors.password}
        />
        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-anthracite-500">
        {t('haveAccount')}{' '}
        <Link
          href="/login"
          className="font-semibold text-primary-700 hover:text-primary-800"
        >
          {t('loginLink')}
        </Link>
      </p>
    </Card>
  );
}
