/**
 * Üzleti „insight"-ok: költség-anomáliák a szerviztörténetből.
 *
 * NEM teljes TMS – a meglévő szerviz/riport adatra épülő, olvasásidőben
 * számított jelzések: túlárazott tétel, duplikált számla, szokatlan összeg.
 */

/** Egy észlelt anomália fajtája. */
export const AnomalyType = {
  /** Egy tétel egységára kiugróan magasabb a saját kategória-átlagnál. */
  PRICE_SPIKE: 'price_spike',
  /** Ugyanaz a számlaszám ugyanattól a beszállítótól többször. */
  DUPLICATE_INVOICE: 'duplicate_invoice',
  /** Egy számla bruttó összege kiugró a cég átlagához képest. */
  UNUSUAL_AMOUNT: 'unusual_amount',
} as const;

export type AnomalyType = (typeof AnomalyType)[keyof typeof AnomalyType];

/** Súlyosság (UI szín + rendezés). */
export const AnomalySeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type AnomalySeverity =
  (typeof AnomalySeverity)[keyof typeof AnomalySeverity];

export const ALL_ANOMALY_TYPES: readonly AnomalyType[] =
  Object.values(AnomalyType);

/** Egy tétel akkor „price spike", ha ennyiszerese a kategória-mediánnak. */
export const PRICE_SPIKE_RATIO = 1.5;
/** Egy számla akkor „unusual amount", ha ennyiszerese a cég-mediánnak. */
export const UNUSUAL_AMOUNT_RATIO = 3;
