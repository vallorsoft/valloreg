import { Injectable } from '@nestjs/common';
import type { VehicleRecall } from '@valloreg/shared';
import type { RecallProvider, RecallQuery } from '../recall.provider';

/**
 * Kurált, beépített visszahívás-lista (INGYENES, kulcs nélkül fut). Néhány
 * ismert, nyilvánosan kommunikált európai visszahívás – demóhoz és alap
 * lefedettséghez. Éles, teljes lefedettséghez a `external` provider köthető
 * be egy ingyenes feedre (EU Safety Gate / car-recalls.eu).
 *
 * A márka/modell illesztés laza (kis-nagybetű és részszó), az év opcionális.
 */
const CURATED: VehicleRecall[] = [
  {
    reference: 'EU-RAPEX-A12/0123',
    makeModel: 'volkswagen golf',
    yearFrom: 2013,
    yearTo: 2017,
    hazard: 'Lehetséges üzemanyag-szivárgás a befecskendező csatlakozásnál.',
    remedy: 'A csatlakozó ellenőrzése és szükség szerinti cseréje a márkaszervizben.',
    source: 'curated',
    publishedAt: '2018-03-14',
  },
  {
    reference: 'EU-RAPEX-A12/0456',
    makeModel: 'ford transit',
    yearFrom: 2014,
    yearTo: 2019,
    hazard: 'A kézifék nem megfelelő rögzítése elgurulást okozhat.',
    remedy: 'Kézifék-mechanizmus szoftveres és mechanikus felülvizsgálata.',
    source: 'curated',
    publishedAt: '2020-06-02',
  },
  {
    reference: 'EU-RAPEX-A12/0789',
    makeModel: 'mercedes-benz sprinter',
    yearFrom: 2018,
    yearTo: 2021,
    hazard: 'Az elektromos kormányrásegítő pillanatnyi kimaradása lehetséges.',
    remedy: 'Vezérlőegység szoftverfrissítése.',
    source: 'curated',
    publishedAt: '2021-11-09',
  },
  {
    reference: 'EU-RAPEX-A12/1011',
    makeModel: 'renault master',
    yearFrom: 2019,
    yearTo: 2022,
    hazard: 'A vezérlőlánc-feszítő idő előtti kopása teljesítményvesztést okozhat.',
    remedy: 'Feszítő ellenőrzése, szükség esetén cseréje.',
    source: 'curated',
    publishedAt: '2022-09-21',
  },
];

@Injectable()
export class StubRecallProvider implements RecallProvider {
  getRecalls(query: RecallQuery): Promise<VehicleRecall[]> {
    const make = (query.make ?? '').toLowerCase().trim();
    const model = (query.model ?? '').toLowerCase().trim();
    if (!make && !model) return Promise.resolve([]);

    const matches = CURATED.filter((r) => {
      const key = r.makeModel;
      const makeOk = make ? key.includes(make) : true;
      const modelOk = model ? key.includes(model) : true;
      if (!makeOk || !modelOk) return false;
      if (query.year != null && r.yearFrom != null && r.yearTo != null) {
        return query.year >= r.yearFrom && query.year <= r.yearTo;
      }
      return true;
    });
    return Promise.resolve(matches);
  }
}
