'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  vehiclesApi,
  ApiError,
  type ComplianceScanResult,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Props {
  vehicleId: string;
  /** 'itp' | 'rca' | 'vignette' */
  type: string;
  typeLabel: string;
  onClose: () => void;
  onDone: () => void;
}

const ACCEPT = 'image/jpeg,image/png,application/pdf';

export function ComplianceScanModal({
  vehicleId,
  type,
  typeLabel,
  onClose,
  onDone,
}: Props) {
  const t = useTranslations('vehicles.verification.scan');
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ComplianceScanResult | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await vehiclesApi.scanComplianceDocument(vehicleId, type, file);
      setResult(res);
      setValidUntil(res.validUntil ? res.validUntil.slice(0, 10) : '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorScan'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!result || !validUntil) return;
    setBusy(true);
    setError(null);
    try {
      await vehiclesApi.confirmComplianceDocument(vehicleId, {
        type,
        validUntil: new Date(validUntil).toISOString(),
        file: result.file,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorSave'));
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
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card-hover">
        <h2 className="mb-1 text-lg font-semibold text-anthracite-900">
          {t('title', { type: typeLabel })}
        </h2>
        <p className="mb-4 text-sm text-anthracite-500">{t('subtitle')}</p>

        {!result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-dashed border-anthracite-200 bg-light px-6 py-8 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {t('choose')}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                capture="environment"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="mt-2 text-xs text-anthracite-500">{file.name}</p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button size="sm" disabled={!file || busy} onClick={() => void handleScan()}>
                {busy ? t('scanning') : t('scan')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label={t('validUntil')}
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setFile(null);
                }}
              >
                {t('rescan')}
              </Button>
              <Button size="sm" disabled={!validUntil || busy} onClick={() => void handleSave()}>
                {busy ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
