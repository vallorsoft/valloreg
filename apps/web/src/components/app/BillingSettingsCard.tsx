'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { adminApi, ApiError, type BillingSettings } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const EMPTY: BillingSettings = {
  companyName: '',
  taxNumber: '',
  address: '',
  regCom: '',
  euid: '',
  phone: '',
  contactEmail: '',
  beneficiary: '',
  iban: '',
  bankName: '',
  swift: '',
  notifyEmail: '',
};

// A megjelenített mezők sorrendje + i18n-kulcs.
const FIELDS: (keyof BillingSettings)[] = [
  'companyName',
  'taxNumber',
  'regCom',
  'euid',
  'address',
  'phone',
  'contactEmail',
  'beneficiary',
  'iban',
  'bankName',
  'swift',
  'notifyEmail',
];

/**
 * Platform-szintű számla-/utalási adatok szerkesztése (CSAK Super Admin). A
 * rendszer ezt teszi az előfizetés-igénylő e-mailbe; üres mezőnél az env a
 * tartalék.
 */
export function BillingSettingsCard() {
  const t = useTranslations('admin.billing');
  const [form, setForm] = useState<BillingSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getBillingSettings()
      .then(setForm)
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
  }, [t]);

  const set = (key: keyof BillingSettings, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await adminApi.setBillingSettings(form);
      setForm(saved);
      setNotice(t('saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    const to = (testTo || form.notifyEmail).trim();
    if (!to) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminApi.sendTestEmail(to);
      setTestResult(
        res.ok
          ? t('test.ok', { to })
          : t('test.fail', { error: res.error ?? `${res.status ?? ''}` }),
      );
    } catch (err) {
      setTestResult(err instanceof ApiError ? err.message : t('test.fail', { error: '' }));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-anthracite-900">{t('title')}</h2>
        {notice && <span className="text-xs text-emerald-600">{notice}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      <p className="mb-4 text-xs text-anthracite-500">{t('subtitle')}</p>

      {loading ? (
        <p className="py-4 text-sm text-anthracite-500">{t('loading')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map((key) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block text-xs text-anthracite-500">
                  {t(`fields.${key}` as Parameters<typeof t>[0])}
                </span>
                <input
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm text-anthracite-900"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>

          {/* Teszt-email: Brevo-konfiguráció ellenőrzése */}
          <div className="mt-4 border-t border-anthracite-100 pt-4">
            <p className="mb-2 text-xs font-medium text-anthracite-600">{t('test.title')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder={form.notifyEmail || t('test.placeholder')}
                className="h-10 min-w-[220px] flex-1 rounded-lg border border-anthracite-200 bg-white px-3 text-sm text-anthracite-900"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleTest()}
                disabled={testing}
              >
                {testing ? t('test.sending') : t('test.send')}
              </Button>
            </div>
            {testResult && <p className="mt-2 text-xs text-anthracite-600">{testResult}</p>}
          </div>
        </>
      )}
    </Card>
  );
}
