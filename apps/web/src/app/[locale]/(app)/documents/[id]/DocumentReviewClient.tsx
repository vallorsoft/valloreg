'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { DocumentStatus } from '@valloreg/shared';
import {
  documentsApi,
  vehiclesApi,
  invoicesApi,
  ApiError,
  type DocumentDetail,
  type Vehicle,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { DocumentStatusBadge } from '@/components/app/DocumentStatusBadge';

const CONFIRMABLE = new Set<string>([DocumentStatus.AUTO_OK, DocumentStatus.NEEDS_REVIEW]);

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80
      ? 'bg-green-50 text-green-700'
      : pct >= 60
        ? 'bg-yellow-50 text-yellow-700'
        : 'bg-red-50 text-red-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}%
    </span>
  );
}

function fmt(value: string | number | null | undefined, locale: string): string {
  if (value == null || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(n) ? String(value) : n.toLocaleString(locale);
}

function vehicleLabel(v: Vehicle): string {
  const name = [v.make, v.model].filter(Boolean).join(' ');
  const parts = [v.plate, name].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : v.id.slice(0, 8);
}

export function DocumentReviewClient({ id }: { id: string }) {
  const t = useTranslations('documents');
  const locale = useLocale();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  useEffect(() => {
    documentsApi
      .getById(id)
      .then(setDoc)
      .catch(() => setError(t('review.notFound')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    vehiclesApi
      .list()
      .then(setVehicles)
      .catch(() => {
        /* 401 → AppShell redirect; járművek nélkül a hozzárendelés rejtve marad */
      });
  }, []);

  async function handleConfirm() {
    if (!doc) return;
    setConfirming(true);
    setError(null);
    try {
      const updated = await documentsApi.confirm(id);
      setDoc({ ...doc, status: updated.status });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('review.errorConfirm'));
    } finally {
      setConfirming(false);
    }
  }

  async function handleDownload() {
    try {
      const { downloadUrl } = await documentsApi.getDownloadUrl(id);
      window.open(downloadUrl, '_blank');
    } catch {
      // silent – presign errors are transient
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('actions.confirmDelete'))) return;
    setDeleting(true);
    setError(null);
    try {
      await documentsApi.remove(id);
      router.push(`/${locale}/documents`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('actions.deleteError'));
      setDeleting(false);
    }
  }

  async function handleAssignVehicle(itemId: string, vehicleId: string | null) {
    setSavingItemId(itemId);
    setItemError(null);
    try {
      const updated = await invoicesApi.updateItem(itemId, { vehicleId });
      setDoc((prev) => {
        if (!prev?.invoice) return prev;
        return {
          ...prev,
          invoice: {
            ...prev.invoice,
            items: prev.invoice.items.map((it) =>
              it.id === itemId ? { ...it, vehicleId: updated.vehicleId } : it,
            ),
          },
        };
      });
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : t('review.items.assignError'));
    } finally {
      setSavingItemId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-anthracite-600">{error ?? t('review.notFound')}</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          {t('review.back')}
        </Button>
      </div>
    );
  }

  const invoice = doc.invoice;
  const canConfirm = CONFIRMABLE.has(doc.status);

  // Szállító neve: a linkelt Supplier-ből, vagy az extractionRaw-ból.
  const supplierName =
    invoice?.supplier?.name ??
    (invoice?.extractionRaw as { invoice?: { supplier?: string } } | null)?.invoice?.supplier ??
    null;

  return (
    <>
      <div className="mb-4">
        <button
          className="text-sm text-primary-600 hover:underline"
          onClick={() => router.push(`/${locale}/documents`)}
        >
          ← {t('review.back')}
        </button>
      </div>

      <PageHeading title={doc.fileName} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <DocumentStatusBadge status={doc.status as DocumentStatus} />
        {invoice && <ConfidencePill value={invoice.confidence} />}
        {canConfirm && (
          <Button size="sm" onClick={() => void handleConfirm()} disabled={confirming}>
            {confirming ? t('review.confirming') : t('review.confirm')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void handleDownload()}>
          {t('review.download')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto border-red-200 text-red-600 hover:bg-red-50"
          disabled={deleting}
          onClick={() => void handleDelete()}
        >
          {deleting ? t('actions.deleting') : t('actions.delete')}
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!invoice ? (
        <Card>
          <p className="text-sm text-anthracite-500">{t('review.noInvoice')}</p>
        </Card>
      ) : (
        <>
          {/* Számlaadatok */}
          <Card className="mb-6">
            <h2 className="mb-4 text-base font-semibold text-anthracite-900">
              {t('review.invoice.title')}
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ['review.invoice.supplier', supplierName ?? t('review.invoice.unknown')],
                  ['review.invoice.invoiceNumber', invoice.invoiceNumber],
                  ['review.invoice.date', invoice.date ? new Date(invoice.date).toLocaleDateString(locale) : null],
                  ['review.invoice.currency', invoice.currency],
                  ['review.invoice.netTotal', invoice.netTotal ? `${fmt(invoice.netTotal, locale)} ${invoice.currency ?? ''}`.trim() : null],
                  ['review.invoice.taxTotal', invoice.taxTotal ? `${fmt(invoice.taxTotal, locale)} ${invoice.currency ?? ''}`.trim() : null],
                  ['review.invoice.grossTotal', invoice.grossTotal ? `${fmt(invoice.grossTotal, locale)} ${invoice.currency ?? ''}`.trim() : null],
                ] as [string, string | null][]
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-anthracite-500">{t(key as Parameters<typeof t>[0])}</dt>
                  <dd className="mt-0.5 font-medium text-anthracite-900">{value ?? '-'}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Tételek */}
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-anthracite-100 px-4 py-3">
              <h2 className="text-base font-semibold text-anthracite-900">
                {t('review.items.title')}
              </h2>
              {itemError && <span className="text-xs text-red-600">{itemError}</span>}
            </div>
            {invoice.items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-anthracite-500">{t('review.items.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('review.items.name')}</th>
                      <th className="px-4 py-3 font-semibold">{t('review.items.category')}</th>
                      <th className="px-4 py-3 font-semibold">{t('review.items.vehicle')}</th>
                      <th className="px-4 py-3 font-semibold">{t('review.items.quantity')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('review.items.price')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-anthracite-100">
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-anthracite-900">
                          {item.name}
                          {item.confidence < 0.7 && (
                            <span className="ml-1.5 text-xs text-yellow-500" title="Bizonytalan">
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-anthracite-600">{item.category}</td>
                        <td className="px-4 py-3 text-anthracite-600">
                          <select
                            value={item.vehicleId ?? ''}
                            disabled={savingItemId === item.id || vehicles.length === 0}
                            onChange={(e) =>
                              void handleAssignVehicle(item.id, e.target.value || null)
                            }
                            className="w-full max-w-[180px] rounded-lg border border-anthracite-200 bg-white px-2 py-1 text-sm text-anthracite-900 disabled:opacity-60"
                          >
                            <option value="">{t('review.items.unassigned')}</option>
                            {vehicles.map((v) => (
                              <option key={v.id} value={v.id}>
                                {vehicleLabel(v)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-anthracite-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-medium text-anthracite-900">
                          {fmt(item.price, locale)}
                          {invoice.currency ? ` ${invoice.currency}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
