import { Injectable, Logger } from '@nestjs/common';
import type { VehicleRecall } from '@valloreg/shared';
import { AppConfigService } from '../../config/app-config.service';
import type { RecallProvider, RecallQuery } from '../recall.provider';

/**
 * Visszahívás-lekérés egy KONFIGURÁLHATÓ, INGYENES feedről (pl. EU Safety Gate /
 * car-recalls.eu saját proxy). A várt JSON-válasz egy tömb:
 *   [{ reference, makeModel, yearFrom, yearTo, hazard, remedy, publishedAt }]
 *
 * Ha nincs RECALL_API_URL beállítva, NEM hívunk semmit – üres listát adunk
 * (a benchmark így valódi forrás nélkül is biztonságosan fut). A RO verify
 * providerrel azonos, fail-safe mintát követi.
 */
@Injectable()
export class ExternalRecallProvider implements RecallProvider {
  private readonly logger = new Logger(ExternalRecallProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async getRecalls(query: RecallQuery): Promise<VehicleRecall[]> {
    const { apiUrl, apiKey } = this.config.recall;
    if (!apiUrl) {
      this.logger.warn(
        'BENCHMARK_RECALL_PROVIDER=external, de RECALL_API_URL hiányzik – nincs lekérdezés.',
      );
      return [];
    }
    if (!query.make && !query.model) return [];

    try {
      const url = new URL(apiUrl);
      if (query.make) url.searchParams.set('make', query.make);
      if (query.model) url.searchParams.set('model', query.model);
      if (query.year != null) url.searchParams.set('year', String(query.year));

      const res = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        // Ne lógjon be egy lassú/akadó upstream a benchmark-feldolgozást.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Recall feed hiba: ${res.status}`);
        return [];
      }
      // Méret-korlát: egy ellenséges/hibás feed ne tudjon memóriát kimeríteni.
      const declaredLen = Number(res.headers.get('content-length') ?? 0);
      if (declaredLen > 2_000_000) {
        this.logger.warn(`Recall válasz túl nagy (${declaredLen} bájt) – elvetve.`);
        return [];
      }
      const raw = (await res.json()) as unknown;
      const rows = Array.isArray(raw) ? raw : [];
      // Sor-korlát: a feldolgozott visszahívások számát is korlátozzuk.
      return rows.slice(0, 200).map((r) => normalize(r as Record<string, unknown>));
    } catch (err) {
      this.logger.warn(`Recall lekérés sikertelen: ${(err as Error).message}`);
      return [];
    }
  }
}

/** A feed sorának normalizálása a megosztott VehicleRecall alakra. */
function normalize(r: Record<string, unknown>): VehicleRecall {
  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    reference: str(r.reference) || str(r.id) || '—',
    makeModel: str(r.makeModel).toLowerCase(),
    yearFrom: num(r.yearFrom),
    yearTo: num(r.yearTo),
    hazard: str(r.hazard),
    remedy: str(r.remedy) || null,
    source: 'external',
    publishedAt: str(r.publishedAt) || null,
  };
}
