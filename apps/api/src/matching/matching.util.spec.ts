import { PartType } from '@valloreg/shared';
import {
  MIN_PLAUSIBLE_DAYS,
  normalizePartKey,
  pickSuggestion,
  rankCandidatesByRecency,
  type PartHistoryEntry,
} from './matching.util';

/** Fix viszonyítási dátum (a tesztek determinisztikusak). */
const AS_OF = new Date('2026-06-23T00:00:00Z');

/** Segéd: adott napokkal korábbi dátum. */
function daysAgo(days: number): Date {
  return new Date(AS_OF.getTime() - days * 86_400_000);
}

describe('normalizePartKey', () => {
  it('a cikkszámból képez kulcsot (normalizálva)', () => {
    expect(normalizePartKey('FB-1234', PartType.BRAKES, 'Fékpofa')).toBe('art:FB1234');
    expect(normalizePartKey('of 9988', null, 'akármi')).toBe('art:OF9988');
  });

  it('cikkszám nélkül a típus+névből képez kulcsot', () => {
    expect(normalizePartKey(null, PartType.BRAKES, 'Fékpofa  hátsó')).toBe(
      'pt:brakes:fékpofa hátsó',
    );
    // Túl rövid "cikkszám" → névre esik vissza.
    expect(normalizePartKey('12', PartType.FILTERS, 'Olajszűrő')).toBe('pt:filters:olajszűrő');
  });

  it('üres név és cikkszám nélkül null', () => {
    expect(normalizePartKey(null, PartType.OTHER, '')).toBeNull();
    expect(normalizePartKey('', '', '   ')).toBeNull();
  });
});

describe('jármű-javaslat a csere-előzményből', () => {
  it('a felhozott eset: #1 jármű 3 hete, #2 jármű 14 hónapja → a #2 a javaslat', () => {
    const history: PartHistoryEntry[] = [
      {
        vehicleId: 'veh-1',
        lastReplacedAt: daysAgo(21), // ~3 hete – frissen cserélve
        lastReplacedKm: 150_000,
        timesReplaced: 1,
      },
      {
        vehicleId: 'veh-2',
        lastReplacedAt: daysAgo(426), // ~14 hónapja – esedékes
        lastReplacedKm: 120_000,
        timesReplaced: 1,
      },
    ];

    const ranked = rankCandidatesByRecency(history, AS_OF, 200_000);
    const suggestion = pickSuggestion(ranked);

    expect(suggestion).not.toBeNull();
    expect(suggestion!.vehicleId).toBe('veh-2');
    expect(suggestion!.confidence).toBeGreaterThan(0);
    expect(suggestion!.reason).toContain('legrégebben');
  });

  it('ha minden jelöltet frissen cseréltek → nincs javaslat', () => {
    const history: PartHistoryEntry[] = [
      {
        vehicleId: 'veh-1',
        lastReplacedAt: daysAgo(10),
        lastReplacedKm: null,
        timesReplaced: 1,
      },
      {
        vehicleId: 'veh-2',
        lastReplacedAt: daysAgo(MIN_PLAUSIBLE_DAYS - 1),
        lastReplacedKm: null,
        timesReplaced: 1,
      },
    ];

    const ranked = rankCandidatesByRecency(history, AS_OF, null);
    expect(pickSuggestion(ranked)).toBeNull();
  });

  it('egyértelmű szeparáció (legrégebbi >> második) → magasabb confidence', () => {
    const history: PartHistoryEntry[] = [
      {
        vehicleId: 'veh-old',
        lastReplacedAt: daysAgo(500),
        lastReplacedKm: null,
        timesReplaced: 1,
      },
      {
        vehicleId: 'veh-mid',
        lastReplacedAt: daysAgo(120),
        lastReplacedKm: null,
        timesReplaced: 1,
      },
    ];

    const suggestion = pickSuggestion(rankCandidatesByRecency(history, AS_OF, null));
    expect(suggestion!.vehicleId).toBe('veh-old');
    // 500 >= 120 * 1.5 → erős szeparáció.
    expect(suggestion!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('esedékes karbantartási emlékeztető növeli a confidence-t', () => {
    const ranked = rankCandidatesByRecency(
      [
        {
          vehicleId: 'veh-1',
          lastReplacedAt: daysAgo(300),
          lastReplacedKm: null,
          timesReplaced: 1,
        },
      ],
      AS_OF,
      null,
    );
    const base = pickSuggestion(ranked.map((c) => ({ ...c })))!;
    const boosted = pickSuggestion(ranked.map((c) => ({ ...c, dueReminder: true })))!;
    expect(boosted.confidence).toBeGreaterThan(base.confidence);
    expect(boosted.reason).toContain('emlékeztető');
  });

  it('üres előzmény → nincs javaslat', () => {
    expect(pickSuggestion(rankCandidatesByRecency([], AS_OF, null))).toBeNull();
  });
});
