'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  vehiclesApi,
  ApiError,
  errorDebugSuffix,
  type VehicleScanView,
  type ConfirmScanPayload,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Polling: ennyi időnként kérdezzük le a beolvasás állapotát. */
const POLL_INTERVAL_MS = 2000;
/** Polling felső korlát (ms) – e fölött feladjuk és hibát mutatunk. */
const POLL_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Props {
  onClose: () => void;
  /** Mentés után – a hívó frissíti a listát és/vagy a részletre navigál. */
  onSaved: (vehicleId: string) => void;
}

interface FormState {
  plate: string;
  vin: string;
  make: string;
  model: string;
  year: string;
  odometerKm: string;
}

const ACCEPT = 'image/jpeg,image/png,application/pdf';

export function VehicleScanModal({ onClose, onSaved }: Props) {
  const t = useTranslations('vehicles.scan');
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VehicleScanView | null>(null);
  const [form, setForm] = useState<FormState>({
    plate: '',
    vin: '',
    make: '',
    model: '',
    year: '',
    odometerKm: '',
  });

  // A modal bezárása közben futó pollingot le kell állítani (ne állítson state-et
  // egy lecsatolt komponensen).
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const uncertain = new Set(result?.draft?.uncertainFields.map((u) => u.path));

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list).slice(0, 2)); // max 2 oldal
    setError(null);
  }

  /**
   * Indítja a háttér-beolvasást, majd pollingol az eredményre. A hosszú OCR+AI
   * a szerveren, háttérben fut – itt csak az állapotot kérdezzük le.
   */
  async function handleScan() {
    if (files.length === 0) return;
    setScanning(true);
    setError(null);
    try {
      const { scanId } = await vehiclesApi.scanRegistration(files, locale);
      const view = await pollScan(scanId);
      if (!view) return; // megszakítva (bezárták a modalt)

      if (view.status === 'FAILED') {
        setError(view.error || t('errorScan'));
        return;
      }

      setResult(view);
      const d = view.draft;
      setForm({
        plate: d?.plate ?? '',
        vin: d?.vin ?? '',
        make: d?.make ?? '',
        model: d?.model ?? '',
        year: d?.year?.toString() ?? '',
        odometerKm: '',
      });
    } catch (err) {
      // Hálózati/technikai hibánál a nyers "Failed to fetch" helyett lokalizált
      // üzenetet mutatunk (a háttér épp ébredhet – pár másodperc múlva újra).
      setError(scanErrorMessage(err));
    } finally {
      if (!cancelledRef.current) setScanning(false);
    }
  }

  /** Lekérdezi a beolvasás állapotát, amíg DONE/FAILED nem lesz (vagy timeout). */
  async function pollScan(scanId: string): Promise<VehicleScanView | null> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      if (cancelledRef.current) return null;
      const view = await vehiclesApi.getScan(scanId);
      if (view.status === 'DONE' || view.status === 'FAILED') return view;
      if (Date.now() > deadline) {
        // A háttér-feldolgozás nem fejeződött be időben – jellemzően a worker nem
        // dolgozza a sort (Redis/worker probléma), vagy az OCR+AI nagyon lassú.
        return { ...view, status: 'FAILED', error: t('errorTimeout') };
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  function set<K extends keyof FormState>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function numOrUndef(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      const payload: ConfirmScanPayload = {
        vehicleId: result.matchedVehicleId ?? undefined,
        plate: form.plate.trim() || undefined,
        vin: form.vin.trim() || undefined,
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        year: numOrUndef(form.year),
        odometerKm: numOrUndef(form.odometerKm),
        files: result.files,
      };
      const saved = await vehiclesApi.confirmScan(payload);
      onSaved(saved.id);
    } catch (err) {
      setError(
        err instanceof ApiError && !isTechnical(err) ? err.message : t('errorSave'),
      );
    } finally {
      setSaving(false);
    }
  }

  /** Technikai (nem üzleti) hiba: hálózati vagy szerver 500 – nyers üzenet helyett lokalizált. */
  function isTechnical(err: ApiError): boolean {
    return err.code === 'NETWORK_ERROR' || err.code === 'INTERNAL_ERROR';
  }

  function scanErrorMessage(err: unknown): string {
    if (err instanceof ApiError && !isTechnical(err)) return err.message;
    // Technikai hibánál (hálózat / szerver 500) a HTTP-státuszt is jelezzük, hogy
    // a valódi ok (nincs válasz vs. 500) elkülöníthető legyen.
    return `${t('errorScan')}${errorDebugSuffix(err)}`;
  }

  const d = result?.draft;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-anthracite-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover">
        <h2 className="mb-1 text-lg font-semibold text-anthracite-900">
          {t('title')}
        </h2>
        <p className="mb-5 text-sm text-anthracite-500">{t('subtitle')}</p>

        {/* 1. fázis: fájl kiválasztása + beolvasás */}
        {!result && (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-dashed border-anthracite-200 bg-light px-6 py-8 text-center">
              <p className="text-sm text-anthracite-600">{t('hint')}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={scanning}
                onClick={() => inputRef.current?.click()}
              >
                {t('choose')}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => pickFiles(e.target.files)}
              />
              {files.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-anthracite-500">
                  {files.map((f) => (
                    <li key={f.name}>{f.name}</li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                disabled={files.length === 0 || scanning}
                onClick={() => void handleScan()}
              >
                {scanning ? t('scanning') : t('scan')}
              </Button>
            </div>
          </div>
        )}

        {/* 2. fázis: ellenőrzés + mentés */}
        {result && d && (
          <div className="space-y-4">
            {!result.looksLikeRegistration && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t('notRegistrationWarning')}
              </div>
            )}
            {result.matchedVehicleId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t('duplicateWarning')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('plate')}
                value={form.plate}
                onChange={(e) => set('plate', e.target.value)}
                className={uncertain.has('plate') ? 'border-amber-400' : undefined}
              />
              <Input
                label={t('year')}
                type="number"
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
                className={uncertain.has('year') ? 'border-amber-400' : undefined}
              />
            </div>
            <Input
              label={t('vin')}
              value={form.vin}
              onChange={(e) => set('vin', e.target.value)}
              className={uncertain.has('vin') ? 'border-amber-400' : undefined}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('make')}
                value={form.make}
                onChange={(e) => set('make', e.target.value)}
                className={uncertain.has('make') ? 'border-amber-400' : undefined}
              />
              <Input
                label={t('model')}
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                className={uncertain.has('model') ? 'border-amber-400' : undefined}
              />
            </div>
            <Input
              label={t('odometerKm')}
              type="number"
              placeholder={t('odometerHint')}
              value={form.odometerKm}
              onChange={(e) => set('odometerKm', e.target.value)}
            />

            {/* Csak ellenőrzéshez kiolvasott extra adatok (nem mentjük). */}
            <div className="rounded-xl bg-anthracite-50 px-3 py-2 text-xs text-anthracite-600">
              <p className="mb-1 font-semibold text-anthracite-500">
                {t('extraTitle')}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {d.fuelType && <span>{t('fuel')}: {d.fuelType}</span>}
                {d.powerKw != null && <span>{t('power')}: {d.powerKw} kW</span>}
                {d.engineCm3 != null && <span>{t('engine')}: {d.engineCm3} cm³</span>}
                {d.color && <span>{t('color')}: {d.color}</span>}
                {d.firstRegistration && (
                  <span>{t('firstReg')}: {d.firstRegistration}</span>
                )}
                {d.ownerName && <span>{t('owner')}: {d.ownerName}</span>}
              </div>
              <p className="mt-2 text-[11px] text-anthracite-400">
                {t('extraNote')}
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setFiles([]);
                }}
              >
                {t('rescan')}
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                  {saving
                    ? t('saving')
                    : result.matchedVehicleId
                      ? t('update')
                      : t('save')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
