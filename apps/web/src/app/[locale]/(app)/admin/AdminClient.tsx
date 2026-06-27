'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { adminApi, ApiError, type AdminTenantListItem } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageHeading } from '@/components/app/PageHeading';
import { BillingSettingsCard } from '@/components/app/BillingSettingsCard';
import { LoadErrorState, isRealLoadError } from '@/components/app/LoadErrorState';

export function AdminClient() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    setForbidden(false);
    setLoading(true);
    adminApi
      .listTenants()
      .then(setTenants)
      .catch((err) => {
        // 401 → AppShell redirect; 403 → tiltott állapot; egyéb → hibaállapot.
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else if (isRealLoadError(err)) {
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    return (
      <>
        <PageHeading title={t('title')} subtitle={t('subtitle')} />
        <LoadErrorState onRetry={load} />
      </>
    );
  }

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      <Card hoverable className="mb-6">
        <Link href="/admin/legal" className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-anthracite-900">{t('legalLink.title')}</p>
            <p className="mt-1 text-sm text-anthracite-500">{t('legalLink.subtitle')}</p>
          </div>
          <span className="text-primary-600">→</span>
        </Link>
      </Card>

      <BillingSettingsCard />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('table.name')}</th>
                <th className="px-4 py-3 font-semibold">{t('table.plan')}</th>
                <th className="px-4 py-3 font-semibold">{t('table.status')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('table.members')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('table.vehicles')}</th>
                <th className="px-4 py-3 font-semibold text-right">{t('table.documents')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-anthracite-500">
                    {t('empty')}
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="cursor-pointer hover:bg-anthracite-50"
                    onClick={() => router.push(`/${locale}/admin/${tenant.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-anthracite-900">
                      {tenant.name}
                      <span className="block text-xs text-anthracite-400">
                        {tenant.email ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-anthracite-600">
                      {tenant.subscription
                        ? t(`plans.${tenant.subscription.planTier}` as Parameters<typeof t>[0])
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-anthracite-600">
                      {tenant.subscription
                        ? t(`statuses.${tenant.subscription.status}` as Parameters<typeof t>[0])
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-anthracite-600">
                      {tenant.counts.members}
                    </td>
                    <td className="px-4 py-3 text-right text-anthracite-600">
                      {tenant.counts.vehicles}
                    </td>
                    <td className="px-4 py-3 text-right text-anthracite-600">
                      {tenant.counts.documents}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
