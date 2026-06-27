'use client';

import { Fragment, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SPREADSHEET_EXTENSIONS, SpreadsheetRowAction } from '@valloreg/shared';
import type { SpreadsheetImportPreview, SpreadsheetImportCommitResult } from '@valloreg/shared';
import { documentsApi, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useModalA11y } from '@/components/app/useModalA11y';

interface Props {
  onClose: () => void;
  onDone: () => void;
}

const ACTION_TONE: Record<string, BadgeTone> = {
  [SpreadsheetRowAction.CREATE]: 'success',
  [SpreadsheetRowAction.DUPLICATE]: 'info',
  [SpreadsheetRowAction.SKIP]: 'neutral',
};

const ACCEPT =
  SPREADSHEET_EXTENSIONS.map((e) => `.${e}`).join(',') +
  ',application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

export function SpreadsheetImportModal({ onClose, onDone }: Props) {
  const t = useTranslations('documents.import');
  const dialogRef = useModalA11y(onClose);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SpreadsheetImportPreview | null>(null);
  const [result, setResult] = useState<SpreadsheetImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleRow(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handlePreview() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await documentsApi.importSpreadsheetPreview(file));
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
      setResult(await documentsApi.importSpreadsheetCommit(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorCommit'));
    } finally {
      setBusy(false);
    }
  }

  const skippedSheets = preview?.sheets.filter((s) => s.skipped) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-anthracite-900/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spreadsheet-import-title"
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover focus:outline-none"
      >
        <h2
          id="spreadsheet-import-title"
          className="mb-1 text-lg font-semibold text-anthracite-900"
        >
          {t('title')}
        </h2>
        <p className="mb-4 text-sm text-anthracite-500">{t('subtitle')}</p>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-anthracite-50 px-4 py-3 text-sm">
              <p className="font-medium text-anthracite-900">{t('doneTitle')}</p>
              <p className="mt-1 text-anthracite-600">
                {t('summaryDone', {
                  created: result.created,
                  skipped: result.skipped,
                })}
              </p>
            </div>
            {result.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e) => (
                  <li key={`${e.sheet}-${e.rowNumber}`}>
                    {e.sheet} · {t('row')} {e.rowNumber}: {e.message}
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
            {/* Fájlválasztás */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {t('choose')}
              </Button>
              {file && <span className="text-xs text-anthracite-500">{file.name}</span>}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {/* Előnézet */}
            {preview && (
              <div className="space-y-3">
                <p className="text-sm text-anthracite-600">
                  {t('summaryPreview', {
                    total: preview.summary.total,
                    create: preview.summary.create,
                    duplicate: preview.summary.duplicate,
                    withWarnings: preview.summary.withWarnings,
                  })}
                </p>

                {skippedSheets.length > 0 && (
                  <p className="text-xs text-anthracite-400">
                    {t('sheetsSkipped', {
                      names: skippedSheets.map((s) => s.name).join(', '),
                    })}
                  </p>
                )}

                <div className="max-h-80 overflow-auto rounded-xl border border-anthracite-100">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-anthracite-50 text-anthracite-600">
                      <tr>
                        <th className="px-2 py-2">{t('col.sheet')}</th>
                        <th className="px-2 py-2">{t('col.date')}</th>
                        <th className="px-2 py-2">{t('col.invoiceNumber')}</th>
                        <th className="px-2 py-2">{t('col.supplier')}</th>
                        <th className="px-2 py-2">{t('col.vehicle')}</th>
                        <th className="px-2 py-2">{t('col.items')}</th>
                        <th className="px-2 py-2">{t('col.total')}</th>
                        <th className="px-2 py-2">{t('col.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-anthracite-100">
                      {preview.rows.map((r) => {
                        const key = `${r.sheet}-${r.rowNumber}`;
                        const isOpen = expanded.has(key);
                        return (
                          <Fragment key={key}>
                            <tr>
                              <td className="px-2 py-1.5 text-anthracite-500">{r.sheet}</td>
                              <td className="px-2 py-1.5">{r.date || '–'}</td>
                              <td className="px-2 py-1.5">{r.invoiceNumber || '–'}</td>
                              <td className="px-2 py-1.5">{r.supplier || '–'}</td>
                              <td className="px-2 py-1.5">
                                {r.matchedVehicleId ? (
                                  r.vehiclePlate
                                ) : (
                                  <span className="text-amber-600">
                                    {r.vehiclePlate ? r.vehiclePlate : t('noVehicle')}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                <button
                                  type="button"
                                  className="text-primary-600 hover:underline disabled:text-anthracite-400 disabled:no-underline"
                                  disabled={r.items.length === 0}
                                  onClick={() => toggleRow(key)}
                                >
                                  {isOpen ? '▾ ' : '▸ '}
                                  {t('itemsCount', { count: r.items.length })}
                                </button>
                              </td>
                              <td className="px-2 py-1.5">
                                {r.grossTotal != null ? r.grossTotal : '–'}
                              </td>
                              <td className="px-2 py-1.5">
                                <Badge tone={ACTION_TONE[r.action]}>
                                  {t(`action.${r.action}`)}
                                </Badge>
                                {r.warnings.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {r.warnings.map((w) => (
                                      <span
                                        key={w}
                                        className="rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700"
                                      >
                                        {t(`warnings.${w}`)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                            {isOpen && r.items.length > 0 && (
                              <tr className="bg-anthracite-50/60">
                                <td colSpan={8} className="px-3 py-2">
                                  <ul className="space-y-1">
                                    {r.items.map((it, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-baseline justify-between gap-3 text-anthracite-700"
                                      >
                                        <span>
                                          {it.articleNumber && (
                                            <span className="mr-2 font-mono text-anthracite-500">
                                              {it.articleNumber}
                                            </span>
                                          )}
                                          {it.name || '–'}
                                        </span>
                                        <span className="shrink-0 text-anthracite-500">
                                          × {it.quantity}
                                          {it.unit ? ` ${it.unit}` : ''}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
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
                <Button size="sm" disabled={!file || busy} onClick={() => void handlePreview()}>
                  {busy ? t('loading') : t('preview')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={busy || preview.summary.create === 0}
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
