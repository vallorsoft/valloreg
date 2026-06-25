'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALL_FEATURE_KEYS,
  BillingInterval,
  PLAN_LIMITS,
  PLAN_CURRENCY,
  planPrice,
  PlanTier,
  STORAGE_ADDONS,
  UNLIMITED,
} from '@valloreg/shared';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { SectionHeading } from './SectionHeading';
import { cn } from '@/lib/cn';

// Megjelenített sávok (3): Start · Pro · Fleet. A „Pro" a kiemelt, ajánlott csomag.
const PLAN_ORDER: PlanTier[] = [
  PlanTier.START,
  PlanTier.PRO,
  PlanTier.FLEET,
];

const HIGHLIGHTED: PlanTier = PlanTier.PRO;

const BYTES_PER_GB = 1024 * 1024 * 1024;

export function Pricing() {
  const t = useTranslations('landing.pricing');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    BillingInterval.MONTHLY,
  );
  const isYearly = billingInterval === BillingInterval.YEARLY;

  const fmtNum = (v: number) =>
    v === UNLIMITED ? '∞' : v.toLocaleString('hu-HU');

  // Az összehasonlító táblázat keret-sorai (a funkció-sorokat a feature-flagek adják).
  const compareLimitRows = [
    {
      label: t('compare.price'),
      values: PLAN_ORDER.map(
        (tier) =>
          `${planPrice(tier, billingInterval).toLocaleString('hu-HU')} ${PLAN_CURRENCY} ${
            isYearly ? t('perYear') : t('perMonth')
          }`,
      ),
    },
    {
      label: t('compare.vehicles'),
      values: PLAN_ORDER.map((tier) => fmtNum(PLAN_LIMITS[tier].maxVehicles)),
    },
    {
      label: t('compare.users'),
      values: PLAN_ORDER.map((tier) => fmtNum(PLAN_LIMITS[tier].maxUsers)),
    },
    {
      label: t('compare.documents'),
      values: PLAN_ORDER.map((tier) =>
        fmtNum(PLAN_LIMITS[tier].maxDocumentsPerMonth),
      ),
    },
    {
      label: t('compare.storage'),
      values: PLAN_ORDER.map(
        (tier) =>
          `${Math.round(PLAN_LIMITS[tier].maxStorageBytes / BYTES_PER_GB)} GB`,
      ),
    },
  ];

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-anthracite-500">
          {t('transferNote')}
        </p>

        {/* Havi / Éves választó */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="inline-flex rounded-full border border-anthracite-200 p-1">
            {[BillingInterval.MONTHLY, BillingInterval.YEARLY].map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setBillingInterval(iv)}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition',
                  billingInterval === iv
                    ? 'bg-primary-600 text-white'
                    : 'text-anthracite-600 hover:text-anthracite-900',
                )}
              >
                {iv === BillingInterval.MONTHLY
                  ? t('billingMonthly')
                  : t('billingYearly')}
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-primary-700">{t('yearlyNote')}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const limits = PLAN_LIMITS[tier];
            const highlighted = tier === HIGHLIGHTED;

            const vehicles =
              limits.maxVehicles === UNLIMITED
                ? t('vehiclesUnlimited')
                : t('vehicles', { count: limits.maxVehicles });
            const users =
              limits.maxUsers === UNLIMITED
                ? t('usersUnlimited')
                : t('users', { count: limits.maxUsers });
            const documents =
              limits.maxDocumentsPerMonth === UNLIMITED
                ? t('documentsUnlimited')
                : t('documents', { count: limits.maxDocumentsPerMonth });
            const storage = t('storage', {
              count: Math.round(limits.maxStorageBytes / BYTES_PER_GB),
            });

            return (
              <Card
                key={tier}
                className={cn(
                  'relative flex flex-col',
                  highlighted &&
                    'border-primary-500 ring-2 ring-primary-500',
                )}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-semibold text-white">
                    {t('mostPopular')}
                  </span>
                )}
                <h3 className="text-xl font-bold text-anthracite-900">
                  {t(`plans.${tier}.name`)}
                </h3>
                <p className="mt-2 min-h-[3rem] text-sm text-anthracite-600">
                  {t(`plans.${tier}.description`)}
                </p>

                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-anthracite-900">
                    {planPrice(tier, billingInterval).toLocaleString('hu-HU')}{' '}
                    {PLAN_CURRENCY}
                  </span>
                  <span className="text-sm text-anthracite-400">
                    {isYearly ? t('perYear') : t('perMonth')}
                  </span>
                </p>
                <p className="mt-1 text-xs font-medium text-primary-700">
                  {isYearly ? t('monthFree') : t('freeTrial')}
                </p>

                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-anthracite-400">
                  {t('limitsTitle')}
                </p>
                <ul className="mt-3 space-y-3 text-sm text-anthracite-700">
                  <li className="flex items-center gap-2">
                    <Check /> {vehicles}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check /> {users}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check /> {documents}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check /> {storage}
                  </li>
                </ul>

                <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-anthracite-400">
                  {t('featuresTitle')}
                </p>
                <ul className="mt-3 flex-1 space-y-3 text-sm">
                  {ALL_FEATURE_KEYS.map((key) => {
                    const included = limits.features.includes(key);
                    return (
                      <li
                        key={key}
                        className={cn(
                          'flex items-center gap-2',
                          included ? 'text-anthracite-700' : 'text-anthracite-300',
                        )}
                      >
                        {included ? <Check /> : <Cross />}
                        <span className={included ? '' : 'line-through'}>
                          {t(`features.${key}`)}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6 rounded-xl bg-anthracite-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                    {t('recommendedForLabel')}
                  </p>
                  <p className="mt-1 min-h-[3.5rem] text-sm text-anthracite-700">
                    {t(`plans.${tier}.recommendedFor`)}
                  </p>
                </div>

                <Link href="/register" className="mt-6">
                  <Button
                    fullWidth
                    variant={highlighted ? 'primary' : 'outline'}
                  >
                    {t('cta')}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <h3 className="text-lg font-bold text-anthracite-900">
            {t('addonsTitle')}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-anthracite-500">
            {t('addonsNote')}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {STORAGE_ADDONS.map((addon) => (
              <span
                key={addon.extraGB}
                className="rounded-full border border-anthracite-200 bg-white px-4 py-2 text-sm font-medium text-anthracite-700"
              >
                {t('addonItem', { gb: addon.extraGB, price: addon.pricePerMonth })}
              </span>
            ))}
          </div>
        </div>

        {/* Összehasonlító táblázat */}
        <div className="mt-20">
          <h3 className="text-center text-lg font-bold text-anthracite-900">
            {t('compare.title')}
          </h3>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-anthracite-200">
                  <th className="px-4 py-3 text-left font-semibold text-anthracite-600">
                    {t('compare.feature')}
                  </th>
                  {PLAN_ORDER.map((tier) => (
                    <th
                      key={tier}
                      className={cn(
                        'px-4 py-3 text-center font-semibold text-anthracite-900',
                        tier === HIGHLIGHTED && 'bg-primary-50',
                      )}
                    >
                      {t(`plans.${tier}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-anthracite-100">
                {compareLimitRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-anthracite-700">{row.label}</td>
                    {row.values.map((val, i) => (
                      <td
                        key={PLAN_ORDER[i]}
                        className={cn(
                          'px-4 py-3 text-center font-medium text-anthracite-900',
                          PLAN_ORDER[i] === HIGHLIGHTED && 'bg-primary-50/50',
                        )}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
                {ALL_FEATURE_KEYS.map((key) => (
                  <tr key={key}>
                    <td className="px-4 py-3 text-anthracite-700">
                      {t(`features.${key}`)}
                    </td>
                    {PLAN_ORDER.map((tier) => (
                      <td
                        key={tier}
                        className={cn(
                          'px-4 py-3 text-center',
                          tier === HIGHLIGHTED && 'bg-primary-50/50',
                        )}
                      >
                        {PLAN_LIMITS[tier].features.includes(key) ? (
                          <span className="font-bold text-primary-700">✓</span>
                        ) : (
                          <span className="text-anthracite-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700"
    >
      ✓
    </span>
  );
}

function Cross() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-anthracite-100 text-xs font-bold text-anthracite-400"
    >
      ✕
    </span>
  );
}
