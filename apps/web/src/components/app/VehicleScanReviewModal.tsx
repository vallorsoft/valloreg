'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  vehiclesApi,
  ApiError,
  type VehicleScanView,
  type ConfirmScanPayload,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  VehicleDetailsFields,
  emptyExtraState,
  extraStateFromDraft,
  extraStateToPayload,
  type VehicleExtraState,
} from '@/components/app/VehicleDetailsFields';

interface Props {
  /** A megerősítendő (kész) beolvasás id-je. */
  scanId: string;
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

/**
 * Egy KÉSZ forgalmi-beolvasás ellenőrzése és járműként mentése. A beolvasás
 * (OCR + AI) már lefutott a feldolgozási listában; itt csak a kiolvasott adatokat
 * tölti be, minden mező szerkeszthető, majd mentéskor a scan CONFIRMED lesz.
 */
export function VehicleScanReviewModal({ scanId, onClose, onSaved }: Props) {
  const t = useTranslations('vehicles.scan');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<VehicleScanView | null>(null);
  const [form, setForm] = useState<FormState>({
    plate: '',
    vin: '',
    make: '',
    model: '',
    year: '',
    odometerKm: '',
  });
  const [extra, setExtra] = useState<VehicleExtraState>(emptyExtraState());

  useEffect(() => {
    let cancelled = false;
    vehiclesApi
      .getScan(scanId)
      .then((view) => {
        if (cancelled) return;
        setScan(view);
        const d = view.draft;
        setForm({
          plate: d?.plate ?? '',
          vin: d?.vin ?? '',
          make: d?.make ?? '',
          model: d?.model ?? '',
          year: d?.year?.toString() ?? '',
          odometerKm: '',
        });
        setExtra(d ? extraStateFromDraft(d) : emptyExtraState());
      })
      .catch(() => {
        if (!cancelled) setError(t('errorSave'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, t]);

  const uncertain = new Set(scan?.draft?.uncertainFields.map((u) => u.path));

  function set<K extends keyof FormState>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function numOrUndef(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  }

  async function handleSave() {
    if (!scan) return;
    setSaving(true);
    setError(null);
    try {
      const payload: ConfirmScanPayload = {
        ...extraStateToPayload(extra),
        scanId: scan.id,
        vehicleId: scan.matchedVehicleId ?? undefined,
        plate: form.plate.trim() || undefined,
        vin: form.vin.trim() || undefined,
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        year: numOrUndef(form.year),
        odometerKm: numOrUndef(form.odometerKm),
        files: scan.files,
      };
      const saved = await vehiclesApi.confirmScan(payload);
      onSaved(saved.id);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code !== 'INTERNAL_ERROR'
          ? err.message
          : t('errorSave'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-anthracite-900/50" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover">
        <h2 className="mb-1 text-lg font-semibold text-anthracite-900">{t('title')}</h2>
        <p className="mb-5 text-sm text-anthracite-500">{t('subtitle')}</p>

        {loading ? (
          <p className="py-10 text-center text-sm text-anthracite-500">{t('saving')}</p>
        ) : !scan ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{error ?? t('errorSave')}</p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!scan.looksLikeRegistration && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t('notRegistrationWarning')}
              </div>
            )}
            {scan.matchedVehicleId && (
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

            {/* Kiolvasott bővebb adatok + tulajdonos/üzembentartó – mind szerkeszthető. */}
            <div className="border-t border-anthracite-100 pt-4">
              <VehicleDetailsFields value={extra} onChange={setExtra} uncertain={uncertain} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                {saving ? t('saving') : scan.matchedVehicleId ? t('update') : t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
