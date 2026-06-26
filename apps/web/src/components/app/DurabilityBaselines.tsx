'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ALL_FLEET_SEGMENTS, isMajorComponent } from '@valloreg/shared';
import {
  durabilityApi,
  ApiError,
  type DurabilitySurveyRow,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

const SOURCE_TONE: Record<string, BadgeTone> = {
  manual: 'info',
  empirical: 'success',
  seed: 'neutral',
};

/**
 * Tartósság-felmérés SZEGMENSENKÉNT + KÉZI felülírás. A várható élettartam
 * kategóriánként más (furgon vs. nyerges vs. pótkocsi); minden érték kézzel is
 * beállítható az alapértelmezett (tanult/seed) mellett. ANALYTICS feature
 * (403 esetén csendben elrejtve).
 */
export function DurabilityBaselines() {
  const t = useTranslations('insights.durability');
  const tseg = useTranslations('vehicles.segments');
  const tmc = useTranslations('majorComponents');
  const locale = useLocale();
  const [rows, setRows] = useState<DurabilitySurveyRow[]>([]);
  const [segment, setSegment] = useState<string>(ALL_FLEET_SEGMENTS[0] as string);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compLabel = (c: string) =>
    isMajorComponent(c)
      ? (tmc as unknown as (k: string) => string)(`components.${c}`)
      : (tmc as unknown as (k: string) => string)('components.other');
  const segLabel = (s: string) => (tseg as unknown as (k: string) => string)(s);

  const refresh = useCallback(async () => {
    try {
      setRows(await durabilityApi.survey());
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!available) return null;

  const segmentRows = rows.filter((r) => r.segment === segment);

  async function handleSave(r: DurabilitySurveyRow) {
    const raw = edit[r.component];
    const km = Number((raw ?? '').replace(/\s/g, ''));
    if (!Number.isFinite(km) || km <= 0) return;
    setBusy(r.component);
    setError(null);
    try {
      await durabilityApi.setBaseline(r.segment, r.component, Math.round(km));
      setEdit((p) => ({ ...p, [r.component]: '' }));
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  async function handleClear(r: DurabilitySurveyRow) {
    setBusy(r.component);
    setError(null);
    try {
      await durabilityApi.clearBaseline(r.segment, r.component);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-anthracite-700">{t('title')}</h2>
      <p className="mb-2 text-xs text-anthracite-500">{t('subtitle')}</p>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-anthracite-500">{t('segment')}</label>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="h-9 rounded-lg border border-anthracite-200 bg-white px-2 text-sm text-anthracite-900"
        >
          {ALL_FLEET_SEGMENTS.map((s) => (
            <option key={s} value={s}>{segLabel(s)}</option>
          ))}
        </select>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('component')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('expectedKm')}</th>
                <th className="px-4 py-3 font-semibold">{t('source')}</th>
                <th className="px-4 py-3 text-right font-semibold">{t('samples')}</th>
                <th className="px-4 py-3 font-semibold">{t('override')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-sm text-anthracite-500">{t('loading')}</td></tr>
              ) : (
                segmentRows.map((r) => (
                  <tr key={r.component}>
                    <td className="px-4 py-3 font-medium text-anthracite-900">{compLabel(r.component)}</td>
                    <td className="px-4 py-3 text-right text-anthracite-700">
                      {r.expectedKm.toLocaleString(locale)} km
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={SOURCE_TONE[r.source] ?? 'neutral'}>
                        {t(`sources.${r.source}` as Parameters<typeof t>[0])}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-anthracite-500">{r.sampleCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={edit[r.component] ?? ''}
                          placeholder={String(r.overrideKm ?? r.seedKm)}
                          onChange={(e) =>
                            setEdit((p) => ({ ...p, [r.component]: e.target.value }))
                          }
                          className="h-9 w-28 rounded-lg border border-anthracite-200 bg-white px-2 text-sm text-anthracite-900"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.component}
                          onClick={() => void handleSave(r)}
                        >
                          {t('save')}
                        </Button>
                        {r.overrideKm != null && (
                          <button
                            className="text-xs text-anthracite-400 hover:text-red-600 disabled:opacity-50"
                            disabled={busy === r.component}
                            onClick={() => void handleClear(r)}
                          >
                            {t('clear')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
