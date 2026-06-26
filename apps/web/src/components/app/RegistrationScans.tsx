'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  vehiclesApi,
  ApiError,
  errorDebugSuffix,
  type VehicleScanListItem,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { VehicleScanStatusBadge } from '@/components/app/VehicleScanStatusBadge';
import { VehicleScanReviewModal } from '@/components/app/VehicleScanReviewModal';

const ACCEPT = 'image/jpeg,image/png,application/pdf';
/** Feldolgozás alatti állapotok – ezek alatt pollingolunk. */
const PROCESSING = new Set<string>(['PENDING', 'OCR_RUNNING', 'EXTRACTING']);

interface Props {
  /** Mentés után – a szülő frissíti a járműlistát és a részletre navigál. */
  onConfirmed: (vehicleId: string) => void;
}

/**
 * Forgalmi-beolvasás a számlafeltöltéshez hasonló folyamattal: feltöltöd (1–2
 * oldal egy forgalmiról) → bekerül a listába → státusz mutatja a feldolgozást →
 * ha kész, „Mentés járműként" gombbal ellenőrzöd és elmented.
 */
export function RegistrationScans({ onConfirmed }: Props) {
  const t = useTranslations('vehicles.scans');
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  const [scans, setScans] = useState<VehicleScanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setScans(await vehiclesApi.listScans());
    } catch {
      // 401 → AppShell kezeli; feature off → 403, ilyenkor üres marad
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 4 másodpercenként frissít, amíg van feldolgozás alatti beolvasás.
  useEffect(() => {
    if (!scans.some((s) => PROCESSING.has(s.status))) return;
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [scans, refresh]);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, 2); // egy forgalmi = max 2 oldal
    setUploading(true);
    setError(null);
    try {
      await vehiclesApi.scanRegistration(files, locale);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code !== 'INTERNAL_ERROR' && err.code !== 'NETWORK_ERROR'
          ? err.message
          : `${t('errorUpload')}${errorDebugSuffix(err)}`,
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDismiss(id: string) {
    setDismissingId(id);
    setError(null);
    try {
      await vehiclesApi.deleteScan(id);
      setScans((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorUpload'));
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <Card className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-anthracite-900">{t('title')}</h2>
        <p className="text-sm text-anthracite-500">{t('subtitle')}</p>
      </div>

      {/* Feltöltő (drag & drop vagy fájlválasztó) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-light px-6 py-8 text-center transition-colors',
          dragging ? 'border-primary-500 bg-primary-50' : 'border-anthracite-200',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <p className="text-sm text-anthracite-600">{t('uploadHint')}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t('uploading') : t('choose')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Beolvasások listája státusszal */}
      {loading ? (
        <p className="mt-4 text-center text-sm text-anthracite-500">{t('loading')}</p>
      ) : scans.length === 0 ? (
        <p className="mt-4 text-center text-sm text-anthracite-500">{t('empty')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 text-anthracite-600">
              <tr>
                <th className="px-3 py-2 font-semibold">{t('table.file')}</th>
                <th className="px-3 py-2 font-semibold">{t('table.uploadedAt')}</th>
                <th className="px-3 py-2 font-semibold">{t('table.status')}</th>
                <th className="px-3 py-2 font-semibold">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {scans.map((s) => (
                <tr key={s.id} className="hover:bg-anthracite-50">
                  <td className="px-3 py-2 font-medium text-anthracite-900">
                    {s.plate || s.fileName}
                    {s.fileCount > 1 && (
                      <span className="ml-1 text-xs text-anthracite-400">
                        {t('pages', { count: s.fileCount })}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-anthracite-500">
                    {new Date(s.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-3 py-2">
                    <VehicleScanStatusBadge status={s.status} />
                    {s.status === 'FAILED' && s.error && (
                      <span className="ml-2 text-xs text-red-500">{s.error}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-3">
                      {s.status === 'DONE' && (
                        <button
                          className="text-sm font-medium text-primary-600 hover:underline"
                          onClick={() => setReviewId(s.id)}
                        >
                          {s.matchedVehicleId ? t('updateVehicle') : t('saveAsVehicle')}
                        </button>
                      )}
                      <button
                        className="text-sm text-red-500 hover:underline disabled:opacity-50"
                        disabled={dismissingId === s.id}
                        onClick={() => void handleDismiss(s.id)}
                      >
                        {dismissingId === s.id ? t('dismissing') : t('dismiss')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewId && (
        <VehicleScanReviewModal
          scanId={reviewId}
          onClose={() => setReviewId(null)}
          onSaved={(vehicleId) => {
            setReviewId(null);
            void refresh();
            onConfirmed(vehicleId);
          }}
        />
      )}
    </Card>
  );
}
