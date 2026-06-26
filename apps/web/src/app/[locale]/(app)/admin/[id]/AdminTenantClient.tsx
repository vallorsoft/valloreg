'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ALL_FEATURE_KEYS,
  PLAN_LIMITS,
  PlanTier,
  type FeatureKey,
} from '@valloreg/shared';
import {
  adminApi,
  ApiError,
  type AdminTenantDetail,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { LoadErrorState } from '@/components/app/LoadErrorState';

// A jelenleg árusított csomagok (Start / Pro / Fleet). A BUSINESS már nem
// választható újként, de ha egy cég még azon van, a select megtartja.
const ACTIVE_PLAN_TIERS: PlanTier[] = [
  PlanTier.STARTER,
  PlanTier.STANDARD,
  PlanTier.PROFESSIONAL,
];
const STATUS_OPTIONS = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const;

export function AdminTenantClient({ id }: { id: string }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();

  const [data, setData] = useState<AdminTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [planTier, setPlanTier] = useState<string>(PlanTier.STARTER);
  const [status, setStatus] = useState<string>('ACTIVE');
  const [savingSub, setSavingSub] = useState(false);
  const [extraStorageGb, setExtraStorageGb] = useState<string>('0');
  const [savingStorage, setSavingStorage] = useState(false);

  const loadTenant = useCallback(() => {
    setLoading(true);
    setForbidden(false);
    setLoadError(false);
    setError(null);
    adminApi
      .getTenant(id)
      .then((d) => {
        setData(d);
        setExtraStorageGb(String(d.extraStorageGb ?? 0));
        if (d.subscription) {
          setPlanTier(d.subscription.planTier);
          setStatus(d.subscription.status);
        }
      })
      .catch((err) => {
        // 401 → AppShell redirect; 403 → tiltott; 404 → nem található; egyéb → hibaállapot.
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          setForbidden(true);
        } else if (err instanceof ApiError && err.status === 404) {
          setError(t('notFound'));
        } else {
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  async function handleSaveSubscription() {
    setSavingSub(true);
    setError(null);
    setNotice(null);
    try {
      const sub = await adminApi.setSubscription(id, { planTier, status });
      setData((prev) => (prev ? { ...prev, subscription: { ...prev.subscription, ...sub } } : prev));
      setNotice(t('subscription.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('subscription.error'));
    } finally {
      setSavingSub(false);
    }
  }

  async function handleSaveStorage() {
    const gb = parseInt(extraStorageGb, 10);
    if (isNaN(gb) || gb < 0) return;
    setSavingStorage(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminApi.setExtraStorage(id, gb);
      setData((prev) => (prev ? { ...prev, extraStorageGb: res.extraStorageGb } : prev));
      setNotice(t('storage.saved'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('storage.error'));
    } finally {
      setSavingStorage(false);
    }
  }

  function featureKeyLabel(key: string): string {
    const k = `featureKeys.${key}` as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : key;
  }

  function roleLabel(role: string): string {
    const k = `roles.${role}` as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : role;
  }

  function overrideState(key: string): 'default' | 'on' | 'off' {
    const ov = data?.featureOverrides.find((o) => o.key === key);
    if (!ov) return 'default';
    return ov.enabled ? 'on' : 'off';
  }

  async function handleFeatureChange(key: string, value: 'default' | 'on' | 'off') {
    setError(null);
    try {
      if (value === 'default') {
        await adminApi.removeFeature(id, key);
        setData((prev) =>
          prev
            ? { ...prev, featureOverrides: prev.featureOverrides.filter((o) => o.key !== key) }
            : prev,
        );
      } else {
        const enabled = value === 'on';
        await adminApi.setFeature(id, key, enabled);
        setData((prev) => {
          if (!prev) return prev;
          const others = prev.featureOverrides.filter((o) => o.key !== key);
          return { ...prev, featureOverrides: [...others, { key, enabled }] };
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('features.error'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  if (forbidden) {
    return <div className="py-16 text-center text-sm text-anthracite-600">{t('forbidden')}</div>;
  }

  if (loadError) {
    return <LoadErrorState onRetry={loadTenant} />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-anthracite-600">{error ?? t('notFound')}</p>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/admin`)}>
          {t('back')}
        </Button>
      </div>
    );
  }

  const planFeatures = PLAN_LIMITS[planTier as PlanTier]?.features ?? [];
  // A select a 3 aktív csomagot kínálja; ha a cég BUSINESS-en van, azt is.
  const planOptions = ACTIVE_PLAN_TIERS.includes(planTier as PlanTier)
    ? ACTIVE_PLAN_TIERS
    : [...ACTIVE_PLAN_TIERS, planTier as PlanTier];
  const planDefault = (key: string) => planFeatures.includes(key as FeatureKey);

  return (
    <>
      <div className="mb-4">
        <button
          className="text-sm text-primary-600 hover:underline"
          onClick={() => router.push(`/${locale}/admin`)}
        >
          ← {t('back')}
        </button>
      </div>

      <PageHeading title={data.name} subtitle={data.email ?? undefined} />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 text-sm text-green-600">{notice}</p>}

      {/* Aggregátumok */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            ['table.members', data.counts.members],
            ['table.vehicles', data.counts.vehicles],
            ['table.documents', data.counts.documents],
            ['table.invoices', data.counts.invoices],
          ] as [string, number][]
        ).map(([key, value]) => (
          <Card key={key}>
            <p className="text-xs text-anthracite-500">{t(key as Parameters<typeof t>[0])}</p>
            <p className="mt-1 text-xl font-semibold text-anthracite-900">{value}</p>
          </Card>
        ))}
      </div>

      {/* Előfizetés */}
      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-anthracite-900">
          {t('subscription.title')}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-anthracite-500">{t('subscription.plan')}</label>
            <select
              value={planTier}
              onChange={(e) => setPlanTier(e.target.value)}
              className="rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
            >
              {planOptions.map((p) => (
                <option key={p} value={p}>
                  {t(`plans.${p}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-anthracite-500">{t('subscription.status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={() => void handleSaveSubscription()} disabled={savingSub}>
            {savingSub ? t('subscription.saving') : t('subscription.save')}
          </Button>
        </div>

        {/* Extra tárhely (vásárlás aktiválása utalás után) */}
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-anthracite-100 pt-4">
          <div>
            <label className="mb-1 block text-xs text-anthracite-500">{t('storage.label')}</label>
            <input
              type="number"
              min={0}
              value={extraStorageGb}
              onChange={(e) => setExtraStorageGb(e.target.value)}
              className="w-28 rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSaveStorage()}
            disabled={savingStorage}
          >
            {savingStorage ? t('storage.saving') : t('storage.save')}
          </Button>
        </div>
      </Card>

      {/* Feature flag-ek */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-anthracite-100 px-4 py-3">
          <h2 className="text-base font-semibold text-anthracite-900">{t('features.title')}</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('features.feature')}</th>
              <th className="px-4 py-3 font-semibold">{t('features.planDefault')}</th>
              <th className="px-4 py-3 font-semibold">{t('features.override')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-anthracite-100">
            {ALL_FEATURE_KEYS.map((key) => (
              <tr key={key}>
                <td className="px-4 py-3 font-medium text-anthracite-900">{featureKeyLabel(key)}</td>
                <td className="px-4 py-3 text-anthracite-600">
                  {planDefault(key) ? t('features.enabled') : t('features.disabled')}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={overrideState(key)}
                    onChange={(e) =>
                      void handleFeatureChange(key, e.target.value as 'default' | 'on' | 'off')
                    }
                    className="rounded-lg border border-anthracite-200 bg-white px-2 py-1 text-sm text-anthracite-900"
                  >
                    <option value="default">{t('features.useDefault')}</option>
                    <option value="on">{t('features.forceOn')}</option>
                    <option value="off">{t('features.forceOff')}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Tagok */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-anthracite-100 px-4 py-3">
          <h2 className="text-base font-semibold text-anthracite-900">{t('members.title')}</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('members.name')}</th>
              <th className="px-4 py-3 font-semibold">{t('members.email')}</th>
              <th className="px-4 py-3 font-semibold">{t('members.role')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-anthracite-100">
            {data.members.map((m) => (
              <tr key={m.membershipId}>
                <td className="px-4 py-3 font-medium text-anthracite-900">{m.user.name ?? '-'}</td>
                <td className="px-4 py-3 text-anthracite-600">{m.user.email}</td>
                <td className="px-4 py-3 text-anthracite-600">{roleLabel(m.role)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
