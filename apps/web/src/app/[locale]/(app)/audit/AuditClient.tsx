'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TenantRole } from '@valloreg/shared';
import { auditApi, authApi, ApiError, type AuditLogEntry } from '@/lib/api';
import { getActiveTenantId } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';

const PAGE_SIZE = 50;
const AUDIT_ROLES = new Set<string>([TenantRole.OWNER, TenantRole.ADMIN]);

/** Rövidített uuid (első szegmens), a teljes érték a title-ben marad. */
function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function AuditClient() {
  const t = useTranslations('audit');
  const locale = useLocale();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (skip: number): Promise<AuditLogEntry[]> => {
    const page = await auditApi.list({ take: PAGE_SIZE, skip });
    setHasMore(page.length === PAGE_SIZE);
    return page;
  }, []);

  const load = useCallback(async () => {
    try {
      const me = await authApi.me();
      const tenantId = getActiveTenantId();
      const membership = me.memberships.find((m) => m.tenantId === tenantId);
      const canView = membership ? AUDIT_ROLES.has(membership.role) : false;
      setAllowed(canView);
      if (!canView) return;

      const page = await fetchPage(0);
      setEntries(page);
    } catch (err) {
      // 401 → AppShell redirect; egyéb hibát jelzünk.
      if (err instanceof ApiError && err.status !== 401) {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  }, [fetchPage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(entries.length);
      setEntries((prev) => [...prev, ...page]);
    } catch {
      setError(t('error'));
    } finally {
      setLoadingMore(false);
    }
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {allowed === false ? (
        <Card className="py-16">
          <p className="mx-auto max-w-sm text-center text-sm text-anthracite-500">
            {t('accessDenied')}
          </p>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="py-16">
          <div className="mx-auto max-w-sm text-center">
            <h2 className="text-base font-semibold text-anthracite-900">{t('empty.title')}</h2>
            <p className="mt-1 text-sm text-anthracite-500">{t('empty.description')}</p>
          </div>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('columns.time')}</th>
                    <th className="px-4 py-3 font-semibold">{t('columns.action')}</th>
                    <th className="px-4 py-3 font-semibold">{t('columns.resource')}</th>
                    <th className="px-4 py-3 font-semibold">{t('columns.user')}</th>
                    <th className="px-4 py-3 font-semibold">{t('columns.ip')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-anthracite-100">
                  {entries.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-anthracite-600">
                        {formatTime(e.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md bg-anthracite-100 px-2 py-0.5 font-mono text-xs text-anthracite-800">
                          {e.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-anthracite-700">
                        <span className="text-anthracite-900">{e.resourceType}</span>
                        {e.resourceId && (
                          <span
                            className="ml-1 font-mono text-xs text-anthracite-400"
                            title={e.resourceId}
                          >
                            #{shortId(e.resourceId)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-anthracite-600">
                        {e.userId ? (
                          <span className="font-mono text-xs" title={e.userId}>
                            {shortId(e.userId)}
                          </span>
                        ) : (
                          <span className="text-anthracite-400">{t('system')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-anthracite-500">
                        {e.ip ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {hasMore && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? t('loading') : t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
