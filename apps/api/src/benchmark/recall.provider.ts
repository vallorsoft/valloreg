import type { VehicleRecall } from '@valloreg/shared';

/**
 * Jármű-visszahívás (recall) port. A meglévő provider-mintát követi
 * (stub + valódi implementáció, factory-val választva). KIZÁRÓLAG ingyenes
 * forrásokra épül (kurált lista, ill. konfigurált ingyenes feed).
 */
export interface RecallQuery {
  make: string | null;
  model: string | null;
  year: number | null;
}

export interface RecallProvider {
  getRecalls(query: RecallQuery): Promise<VehicleRecall[]>;
}

export const RECALL_PROVIDER = Symbol('RECALL_PROVIDER');
