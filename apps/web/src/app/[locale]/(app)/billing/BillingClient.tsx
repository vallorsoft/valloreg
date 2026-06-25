'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  UNLIMITED,
  PLAN_CURRENCY,
  PlanTier,
  BillingInterval,
  planPrice,
  STORAGE_ADDONS,
} from '@valloreg/shared';
import { cn } from '@/lib/cn';
import {
  billingApi,
  ApiError,
  type BillingOverview,
  type SubscriptionRequestResult,
  type StorageAddonRequestResult,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';

const PLAN_ORDER = [PlanTier.START, PlanTier.PRO, PlanTier.FLEET] as const;

function fmtLimit(value: number, locale: string): string {
  return value === UNLIMITED ? '∞' : value.toLocaleString(locale);
}

function fmtBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const unlimited = limit === UNLIMITED;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary-600';
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-anthracite-100">
      {!unlimited && <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />}
    </div>
  );
}

export function BillingClient() {
  const t = useTranslations('billing');
  const locale = useLocale();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [result, setResult] = useState<SubscriptionRequestResult | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    BillingInterval.MONTHLY,
  );
  const [addonRequesting, setAddonRequesting] = useState<number | null>(null);
  const [addonResult, setAddonResult] = useState<StorageAddonRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi
      .getOverview()
      .then(setData)
      .catch(() => {
        /* 401 → AppShell redirect */
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleRequest(planTier: string) {
    setRequesting(planTier);
    setError(null);
    setResult(null);
    try {
      setResult(await billingApi.requestSubscription(planTier, billingInterval));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('subscribe.error'));
    } finally {
      setRequesting(null);
    }
  }

  const isYearly = billingInterval === BillingInterval.YEARLY;

  async function handleStorageAddon(extraGB: number) {
    setAddonRequesting(extraGB);
    setError(null);
    setAddonResult(null);
    try {
      setAddonResult(await billingApi.requestStorageAddon(extraGB));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('storage.error'));
    } finally {
      setAddonRequesting(null);
    }
  }

  function fmtPrice(value: number): string {
    return `${value.toLocaleString(locale)} ${PLAN_CURRENCY}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  if (!data) return null;

  const usageRows: { label: string; used: number; limit: number }[] = [
    { label: t('usage.vehicles'), used: data.usage.vehicles, limit: data.limits.maxVehicles },
    { label: t('usage.users'), used: data.usage.users, limit: data.limits.maxUsers },
    {
      label: t('usage.documents'),
      used: data.usage.documentsThisMonth,
      limit: data.limits.maxDocumentsPerMonth,
    },
  ];

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      {/* Csomag */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-anthracite-500">{t('plan')}</p>
            <p className="mt-0.5 text-2xl font-bold text-anthracite-900">
              {t(`plans.${data.plan}` as Parameters<typeof t>[0])}
            </p>
          </div>
          {data.status && (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
              {t(`statuses.${data.status}` as Parameters<typeof t>[0])}
            </span>
          )}
        </div>
        {(data.trialEndsAt || data.currentPeriodEnd) && (
          <p className="mt-3 text-sm text-anthracite-500">
            {data.trialEndsAt
              ? t('trialEnds', {
                  date: new Date(data.trialEndsAt).toLocaleDateString(locale),
                })
              : t('periodEnds', {
                  date: new Date(data.currentPeriodEnd as string).toLocaleDateString(locale),
                })}
          </p>
        )}
        <p className="mt-3 text-xs text-anthracite-400">{t('manageNote')}</p>
      </Card>

      {/* Csomagválasztás – utalásos előfizetés */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-anthracite-900">
          {t('subscribe.title')}
        </h2>
        <p className="mt-1 text-sm text-anthracite-500">{t('subscribe.intro')}</p>

        {/* Havi / Éves választó */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-anthracite-200 p-1">
            {[BillingInterval.MONTHLY, BillingInterval.YEARLY].map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setBillingInterval(iv)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  billingInterval === iv
                    ? 'bg-primary-600 text-white'
                    : 'text-anthracite-600 hover:text-anthracite-900',
                )}
              >
                {iv === BillingInterval.MONTHLY
                  ? t('subscribe.monthly')
                  : t('subscribe.yearly')}
              </button>
            ))}
          </div>
          {isYearly && (
            <span className="text-sm font-medium text-primary-700">
              {t('subscribe.yearlyNote')}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const isCurrent = data.plan === tier;
            return (
              <div
                key={tier}
                className="flex flex-col rounded-2xl border border-anthracite-200 p-4"
              >
                <p className="text-sm font-semibold text-anthracite-900">
                  {t(`plans.${tier}` as Parameters<typeof t>[0])}
                </p>
                <p className="mt-1 text-lg font-bold text-anthracite-900">
                  {fmtPrice(planPrice(tier, billingInterval))}
                  <span className="text-xs font-normal text-anthracite-400">
                    {' '}
                    {isYearly ? t('subscribe.perYear') : t('subscribe.perMonth')}
                  </span>
                </p>
                {isYearly && (
                  <p className="mt-0.5 text-xs font-medium text-primary-700">
                    {t('subscribe.monthFree')}
                  </p>
                )}
                <div className="mt-3">
                  <Button
                    size="sm"
                    fullWidth
                    variant={isCurrent ? 'outline' : 'primary'}
                    disabled={requesting !== null || isCurrent}
                    onClick={() => void handleRequest(tier)}
                  >
                    {isCurrent
                      ? t('subscribe.current')
                      : requesting === tier
                        ? t('subscribe.requesting')
                        : t('subscribe.choose')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-anthracite-400">{t('subscribe.note')}</p>
      </Card>

      {/* Utalási adatok – az igénylés után */}
      {result && (
        <Card className="mb-6 border-primary-200 bg-primary-50/40">
          <h2 className="text-base font-semibold text-anthracite-900">
            {t('subscribe.transferTitle')}
          </h2>
          <p className="mt-1 text-sm text-anthracite-600">
            {result.emailedTo
              ? t('subscribe.emailed', { email: result.emailedTo })
              : t('subscribe.emailedFallback')}
          </p>
          <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {(
              [
                ['subscribe.amount', `${result.amount.toLocaleString(locale)} ${result.currency} ${result.interval === 'YEARLY' ? t('subscribe.perYear') : t('subscribe.perMonth')}`],
                ['subscribe.beneficiary', result.bank.beneficiary || '—'],
                ['subscribe.iban', result.bank.iban || '—'],
                ['subscribe.bank', result.bank.bank || '—'],
                ['subscribe.swift', result.bank.swift || '—'],
                ['subscribe.reference', result.reference],
              ] as [string, string][]
            ).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-anthracite-500">
                  {t(key as Parameters<typeof t>[0])}
                </dt>
                <dd className="font-medium text-anthracite-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-anthracite-500">
            {t('subscribe.referenceHint', { reference: result.reference })}
          </p>
        </Card>
      )}

      {/* Használat */}
      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-anthracite-900">{t('usage.title')}</h2>
        <div className="space-y-4">
          {usageRows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-anthracite-700">{row.label}</span>
                <span className="font-medium text-anthracite-900">
                  {row.used.toLocaleString(locale)} / {fmtLimit(row.limit, locale)}
                </span>
              </div>
              <UsageBar used={row.used} limit={row.limit} />
            </div>
          ))}

          {/* Tárhely (byte-alapú) */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-anthracite-700">{t('usage.storage')}</span>
              <span className="font-medium text-anthracite-900">
                {fmtBytes(data.usage.storageBytes)} / {fmtBytes(data.limits.maxStorageBytes)}
              </span>
            </div>
            <UsageBar used={data.usage.storageBytes} limit={data.limits.maxStorageBytes} />
            {data.extraStorageGB > 0 && (
              <p className="mt-1 text-xs text-anthracite-400">
                {t('usage.extraStorage', { gb: data.extraStorageGB })}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Extra tárhely vásárlása */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-anthracite-900">{t('storage.title')}</h2>
        <p className="mt-1 text-sm text-anthracite-500">{t('storage.intro')}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {STORAGE_ADDONS.map((addon) => (
            <Button
              key={addon.extraGB}
              size="sm"
              variant="outline"
              disabled={addonRequesting !== null}
              onClick={() => void handleStorageAddon(addon.extraGB)}
            >
              {addonRequesting === addon.extraGB
                ? t('subscribe.requesting')
                : t('storage.addOption', {
                    gb: addon.extraGB,
                    price: addon.pricePerMonth,
                    currency: PLAN_CURRENCY,
                  })}
            </Button>
          ))}
        </div>

        {addonResult && (
          <div className="mt-4 rounded-2xl border border-primary-200 bg-primary-50/40 p-4">
            <p className="text-sm text-anthracite-600">
              {addonResult.emailedTo
                ? t('subscribe.emailed', { email: addonResult.emailedTo })
                : t('subscribe.emailedFallback')}
            </p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {(
                [
                  [
                    'subscribe.amount',
                    `${addonResult.amount.toLocaleString(locale)} ${addonResult.currency} ${t('subscribe.perMonth')}`,
                  ],
                  ['subscribe.beneficiary', addonResult.bank.beneficiary || '—'],
                  ['subscribe.iban', addonResult.bank.iban || '—'],
                  ['subscribe.bank', addonResult.bank.bank || '—'],
                  ['subscribe.swift', addonResult.bank.swift || '—'],
                  ['subscribe.reference', addonResult.reference],
                ] as [string, string][]
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-anthracite-500">
                    {t(key as Parameters<typeof t>[0])}
                  </dt>
                  <dd className="font-medium text-anthracite-900">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-anthracite-500">
              {t('subscribe.referenceHint', { reference: addonResult.reference })}
            </p>
          </div>
        )}
        <p className="mt-3 text-xs text-anthracite-400">{t('storage.note')}</p>
      </Card>

      {/* Funkciók */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-anthracite-900">{t('features.title')}</h2>
        {data.features.length === 0 ? (
          <p className="text-sm text-anthracite-500">{t('features.none')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.features.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-full bg-anthracite-50 px-3 py-1 text-xs font-medium text-anthracite-700"
              >
                {t(`featureLabels.${f}` as Parameters<typeof t>[0])}
              </span>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
