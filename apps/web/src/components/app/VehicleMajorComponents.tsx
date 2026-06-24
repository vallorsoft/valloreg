'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ALL_MAJOR_COMPONENTS, isMajorComponent } from '@valloreg/shared';
import {
  majorComponentsApi,
  durabilityApi,
  ApiError,
  type MajorComponentEvent,
  type VehicleComponentForecast,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/** Üres hozzáadó-állapot. */
function emptyForm() {
  return {
    component: ALL_MAJOR_COMPONENTS[0] as string,
    kind: 'replacement',
    title: '',
    odometerKm: '',
    date: '',
    partsCost: '',
    laborCost: '',
    notes: '',
  };
}

/** Státusz → színosztály a tartósság-jelvényhez. */
const STATUS_COLOR: Record<string, string> = {
  ok: 'bg-green-50 text-green-700',
  watch: 'bg-amber-50 text-amber-700',
  due: 'bg-orange-50 text-orange-700',
  overdue: 'bg-red-50 text-red-700',
};

function fmt(value: string | null, locale: string): string {
  if (value == null || value === '') return '-';
  const n = parseFloat(value);
  return isNaN(n) ? value : n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/**
 * Egy jármű nagy-alkatrész idővonala (fődarab cserék / felújítások) + kézi
 * rögzítés. A REPORTS feature hiányában (403) csendben elrejtjük a panelt.
 */
export function VehicleMajorComponents({
  vehicleId,
  currency,
}: {
  vehicleId: string;
  currency: string | null;
}) {
  const t = useTranslations('majorComponents');
  const locale = useLocale();
  // A komponens-kulcsot szűkítjük, hogy a tipizált fordító elfogadja (string → union).
  const compLabel = (c: string) =>
    isMajorComponent(c) ? t(`components.${c}`) : t('components.other');
  const [events, setEvents] = useState<MajorComponentEvent[]>([]);
  const [forecasts, setForecasts] = useState<VehicleComponentForecast[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const refresh = useCallback(async () => {
    try {
      const [evts, fc] = await Promise.all([
        majorComponentsApi.listForVehicle(vehicleId),
        durabilityApi.forecastForVehicle(vehicleId).catch(() => []),
      ]);
      setEvents(evts);
      setForecasts(fc);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const set = (patch: Partial<ReturnType<typeof emptyForm>>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const num = (v: string): number | undefined => {
    const n = Number(v.replace(',', '.').replace(/\s/g, ''));
    return v.trim() === '' || !Number.isFinite(n) ? undefined : n;
  };

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const created = await majorComponentsApi.create(vehicleId, {
        component: form.component,
        kind: form.kind,
        title: form.title.trim() || undefined,
        odometerKm: num(form.odometerKm),
        date: form.date || undefined,
        partsCost: num(form.partsCost),
        laborCost: num(form.laborCost),
        currency: currency ?? undefined,
        notes: form.notes.trim() || undefined,
      });
      setEvents((prev) => [created, ...prev]);
      setForm(emptyForm());
      setOpen(false);
      void refresh(); // az előrejelzés újraszámolása az új eseménnyel
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('addError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm(t('confirmDelete'))) return;
    setBusyId(id);
    try {
      await majorComponentsApi.remove(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      void refresh(); // az előrejelzés újraszámolása
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('deleteError'));
    } finally {
      setBusyId(null);
    }
  }

  if (!available) return null;

  return (
    <Card className="mt-6 p-0">
      <div className="flex items-center justify-between border-b border-anthracite-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-anthracite-900">{t('title')}</h2>
          <p className="text-xs text-anthracite-500">{t('subtitle')}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? t('cancel') : t('add')}
        </Button>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-red-600">{error}</p>}

      {open && (
        <div className="grid grid-cols-2 gap-3 border-b border-anthracite-100 bg-anthracite-50/50 p-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('component')}</span>
            <select
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-2 text-sm"
              value={form.component}
              onChange={(e) => set({ component: e.target.value })}
            >
              {ALL_MAJOR_COMPONENTS.map((c) => (
                <option key={c} value={c}>{compLabel(c)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('kind')}</span>
            <select
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-2 text-sm"
              value={form.kind}
              onChange={(e) => set({ kind: e.target.value })}
            >
              <option value="replacement">{t('kinds.replacement')}</option>
              <option value="refurbishment">{t('kinds.refurbishment')}</option>
            </select>
          </label>
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('titleField')}</span>
            <input
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm"
              value={form.title}
              placeholder={t('titlePlaceholder')}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('odometerKm')}</span>
            <input
              type="number"
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm"
              value={form.odometerKm}
              onChange={(e) => set({ odometerKm: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('date')}</span>
            <input
              type="date"
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm"
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('partsCost')}</span>
            <input
              inputMode="decimal"
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm"
              value={form.partsCost}
              onChange={(e) => set({ partsCost: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('laborCost')}</span>
            <input
              inputMode="decimal"
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm"
              value={form.laborCost}
              onChange={(e) => set({ laborCost: e.target.value })}
            />
          </label>
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">{t('notes')}</span>
            <input
              className="h-10 w-full rounded-lg border border-anthracite-200 bg-white px-3 text-sm"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </label>
          <div className="col-span-2 flex justify-end">
            <Button size="sm" disabled={saving} onClick={() => void handleAdd()}>
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </div>
      )}

      {forecasts.length > 0 && (
        <div className="border-b border-anthracite-100 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {t('forecastTitle')}
          </p>
          <ul className="space-y-1.5">
            {forecasts.map((f) => (
              <li key={f.component} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className={'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ' + STATUS_COLOR[f.status]}>
                  {t(`status.${f.status}`)}
                </span>
                <span className="font-medium text-anthracite-900">{compLabel(f.component)}</span>
                {f.estimatedNextDueKm != null && (
                  <span className="text-anthracite-500">
                    {t('nextDue')}: {f.estimatedNextDueKm.toLocaleString(locale)} km
                  </span>
                )}
                {f.estimatedCost != null && (
                  <span className="text-anthracite-500">
                    · {t('estCost')}: {fmt(f.estimatedCost, locale)} {f.currency ?? ''}
                  </span>
                )}
                <span className="text-anthracite-400">
                  ({t(`source.${f.source}`)}, {t('expected')} {f.expectedKm.toLocaleString(locale)} km)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="px-4 py-6 text-sm text-anthracite-500">{t('loading')}</p>
      ) : events.length === 0 ? (
        <p className="px-4 py-6 text-sm text-anthracite-500">{t('empty')}</p>
      ) : (
        <ul className="divide-y divide-anthracite-100">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="font-medium text-anthracite-900">
                  {compLabel(e.component)}
                  {e.kind === 'refurbishment' && (
                    <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                      {t('kinds.refurbishment')}
                    </span>
                  )}
                </p>
                {e.title && <p className="text-sm text-anthracite-600">{e.title}</p>}
                <p className="mt-0.5 text-xs text-anthracite-500">
                  {[
                    e.date ? new Date(e.date).toLocaleDateString(locale) : null,
                    e.odometerKm != null ? `${e.odometerKm.toLocaleString(locale)} km` : null,
                    e.totalCost != null
                      ? `${fmt(e.totalCost, locale)} ${e.currency ?? ''}`.trim()
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                className="text-sm text-red-500 hover:underline disabled:opacity-50"
                disabled={busyId === e.id}
                onClick={() => void handleRemove(e.id)}
              >
                {t('delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
