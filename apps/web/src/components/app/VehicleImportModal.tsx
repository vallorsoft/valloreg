'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  vehiclesApi,
  ApiError,
  type ImportPreview,
  type ImportCommitResult,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useModalA11y } from '@/components/app/useModalA11y';

interface Props {
  onClose: () => void;
  onDone: () => void;
}

const ACTION_TONE: Record<string, BadgeTone> = {
  create: 'success',
  update: 'info',
  error: 'danger',
};

const TEMPLATE =
  'plate,vin,make,model,year,odometerKm\n' +
  'ABC-123,WDB1234567890ABCD,Mercedes-Benz,Actros,2020,152340\n';

export function VehicleImportModal({ onClose, onDone }: Props) {
  const t = useTranslations('vehicles.import');
  const dialogRef = useModalA11y(onClose);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jarmu-import-sablon.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePreview() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await vehiclesApi.importPreview(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorPreview'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await vehiclesApi.importCommit(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorCommit'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-anthracite-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-import-title"
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover focus:outline-none"
      >
        <h2 id="vehicle-import-title" className="mb-1 text-lg font-semibold text-anthracite-900">
          {t('title')}
        </h2>
        <p className="mb-4 text-sm text-anthracite-500">{t('subtitle')}</p>

        {/* Eredmény */}
        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-anthracite-50 px-4 py-3 text-sm">
              <p className="font-medium text-anthracite-900">{t('doneTitle')}</p>
              <p className="mt-1 text-anthracite-600">
                {t('summaryDone', {
                  created: result.created,
                  updated: result.updated,
                  skipped: result.skipped,
                })}
              </p>
            </div>
            {result.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e) => (
                  <li key={e.index}>
                    {t('row')} {e.index}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={onDone}>
                {t('close')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Fájlválasztás + sablon */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {t('choose')}
              </Button>
              <button
                className="text-sm text-primary-600 hover:underline"
                onClick={downloadTemplate}
              >
                {t('template')}
              </button>
              {file && (
                <span className="text-xs text-anthracite-500">{file.name}</span>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Előnézet tábla */}
            {preview && (
              <div>
                <p className="mb-2 text-sm text-anthracite-600">
                  {t('summaryPreview', {
                    total: preview.summary.total,
                    create: preview.summary.create,
                    update: preview.summary.update,
                    error: preview.summary.error,
                  })}
                </p>
                <div className="max-h-72 overflow-auto rounded-xl border border-anthracite-100">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-anthracite-50 text-anthracite-600">
                      <tr>
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">{t('plate')}</th>
                        <th className="px-2 py-2">{t('vin')}</th>
                        <th className="px-2 py-2">{t('makeModel')}</th>
                        <th className="px-2 py-2">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-anthracite-100">
                      {preview.rows.map((r) => (
                        <tr key={r.index}>
                          <td className="px-2 py-1.5 text-anthracite-400">
                            {r.index}
                          </td>
                          <td className="px-2 py-1.5">{r.plate ?? '-'}</td>
                          <td className="px-2 py-1.5">{r.vin ?? '-'}</td>
                          <td className="px-2 py-1.5">
                            {[r.make, r.model].filter(Boolean).join(' ') || '-'}
                          </td>
                          <td className="px-2 py-1.5">
                            <Badge tone={ACTION_TONE[r.action]}>
                              {t(`action.${r.action}`)}
                            </Badge>
                            {r.errors.length > 0 && (
                              <span className="ml-1 text-red-600">
                                {r.errors.join('; ')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('cancel')}
              </Button>
              {!preview ? (
                <Button
                  size="sm"
                  disabled={!file || busy}
                  onClick={() => void handlePreview()}
                >
                  {busy ? t('loading') : t('preview')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busy || preview.summary.create + preview.summary.update === 0}
                  onClick={() => void handleCommit()}
                >
                  {busy ? t('importing') : t('import')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
