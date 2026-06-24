'use client';

import { ErrorCode } from '@valloreg/shared';
import type { ApiErrorBody } from '@valloreg/shared';
import {
  getAccessToken,
  getActiveTenantId,
  getRememberMe,
  setAccessToken,
  clearTokens,
  resolveActiveTenant,
  type AuthTokens,
  type AuthSession,
  type CurrentUser,
  type TenantMembership,
} from './auth';

/**
 * Thin fetch wrapper around the Valloreg REST API.
 *
 * - Base URL comes from NEXT_PUBLIC_API_URL.
 * - Attaches `Authorization: Bearer <access>` and `x-tenant-id` when available.
 * - Parses the shared `ApiErrorBody` shape and throws a typed `ApiError`.
 * - Transparent refresh-token rotation on 401: ha a (rövid életű) access token
 *   lejár, a tárolt refresh tokennel csendben új tokeneket kérünk és újrapróbáljuk
 *   a kérést – így a felhasználó az eszközön bejelentkezve marad (a refresh token
 *   élettartamáig, ami minden használatkor gördül előre).
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * KAPCSOLÓ: same-origin auth. Ha be van kapcsolva, az AUTH-végpontokat (login/
 * register/refresh/logout – ezekhez kell a httpOnly refresh cookie) a saját
 * originról hívjuk (`/api`), amit a Next az API-ra proxyz → first-party cookie,
 * nincs harmadik-fél-cookie gond. Minden MÁS hívás marad az API_BASE_URL-en
 * (cross-origin, access tokennel). Kikapcsolva minden a mostani módon megy.
 */
const SAME_ORIGIN_AUTH =
  process.env.NEXT_PUBLIC_SAME_ORIGIN_AUTH === 'true' ||
  process.env.NEXT_PUBLIC_SAME_ORIGIN_AUTH === '1';
const AUTH_BASE_URL = SAME_ORIGIN_AUTH ? '/api' : API_BASE_URL;

/** Typed error carrying the machine-readable code for i18n mapping. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(
    code: ErrorCode | 'NETWORK_ERROR',
    status: number,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Az auth.errors i18n blokkban LÉTEZŐ kulcsok (minden ErrorCode + NETWORK_ERROR).
 * Ha a backend ezen kívüli kódot ad vissza, INTERNAL_ERROR-ra esünk, hogy a
 * fordító (`te`) ne dobjon hiányzó-kulcs hibát.
 */
const KNOWN_ERROR_KEYS = new Set<string>([
  ...Object.values(ErrorCode),
  'NETWORK_ERROR',
]);

/** Egy ismert i18n hibakulcs egy tetszőleges hibából (fallback: INTERNAL_ERROR). */
export function resolveErrorKey(err: unknown): ErrorCode | 'NETWORK_ERROR' {
  if (err instanceof ApiError && KNOWN_ERROR_KEYS.has(err.code)) {
    return err.code;
  }
  return ErrorCode.INTERNAL_ERROR;
}

/**
 * Diagnosztikai utótag a technikai (nem üzleti) hibákhoz: a HTTP státusz, hogy
 * megkülönböztethető legyen a szerver 500 (INTERNAL_ERROR) a rossz API-URL /
 * 404 / elérhetetlen háttér esetektől. Üzleti hibáknál üres.
 */
export function errorDebugSuffix(err: unknown): string {
  if (
    err instanceof ApiError &&
    (err.code === 'INTERNAL_ERROR' || err.code === 'NETWORK_ERROR')
  ) {
    return err.status ? ` (HTTP ${err.status})` : ' (nincs válasz)';
  }
  return '';
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serializable body; set automatically with the correct header. */
  json?: unknown;
  /** Multipart body (fájlfeltöltés). A Content-Type-ot a böngésző állítja be. */
  form?: FormData;
  /** Skip attaching the Authorization header (e.g. login/register). */
  anonymous?: boolean;
  /** Bázis-URL felülírása (pl. az auth-végpontok same-origin proxyjához). */
  baseUrl?: string;
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers);
  if (options.json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // FormData esetén NEM állítunk Content-Type-ot: a böngésző teszi rá a
  // helyes multipart boundary-t.
  if (!options.anonymous) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const tenantId = getActiveTenantId();
    if (tenantId) headers.set('x-tenant-id', tenantId);
  }
  return headers;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | undefined;
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    // Non-JSON error body – fall through to a generic error.
  }
  const code = (body?.code as ErrorCode | undefined) ?? 'INTERNAL_ERROR';
  const message = body?.message ?? response.statusText;
  return new ApiError(code, response.status, message, body?.details);
}

/**
 * Hideg indítás (Render free) utáni újrapróba-várakozások ms-ben. A háttér ~15
 * perc tétlenség után leáll; az ELSŐ kérés ilyenkor vagy kapcsolat-szinten bukik
 * ("Failed to fetch"), VAGY – jellemzőbben – a Render routere 30–60 mp ébredés
 * után 502/503/504-et ad, mert a boot tovább tart a router-timeoutnál. Mindkettő
 * ÁTMENETI: pár újrapróbával, elég hosszú ablakkal (~70 mp összes várakozás) a
 * szolgáltatás felébred és a kérés átmegy.
 */
const NETWORK_RETRY_DELAYS_MS = [2000, 5000, 10000, 15000, 18000, 20000];

/** Hideg indításra utaló átmeneti HTTP-státuszok (Render gateway ébredés közben). */
const COLD_START_STATUSES = new Set([502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Egyetlen kérés végrehajtása (újrapróba nélkül). */
async function performRequest<T>(
  url: string,
  options: RequestOptions,
  body: BodyInit | undefined,
  init: Omit<RequestOptions, 'json' | 'form' | 'anonymous'>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: buildHeaders(options),
      body,
    });
  } catch (cause) {
    throw new ApiError(
      'NETWORK_ERROR',
      0,
      cause instanceof Error ? cause.message : 'Network request failed',
    );
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Egy kérés a hideg-indítás (Render free) elleni backoff-újrapróbával, de
 * token-refresh NÉLKÜL. A refresh-réteget az `apiRequest` adja köré.
 */
async function sendRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const { json, form, anonymous: _anonymous, baseUrl, ...init } = options;
  const base = baseUrl ?? API_BASE_URL;
  const url = path.startsWith('http') ? path : `${base}${path}`;

  const body =
    form !== undefined
      ? form
      : json !== undefined
        ? JSON.stringify(json)
        : undefined;

  // Hálózati hibára (a kérés el sem ért a szerverig) backoff-fal újrapróbálunk –
  // fájlfeltöltésnél (FormData) is, mert a FormData objektum minden fetch-hívásnál
  // újrakódolódik (nem "elfogyó" stream), és a hideg indítás miatti "Failed to
  // fetch" jellemzően azonnal, szerver-érintés nélkül jön.
  const maxAttempts = NETWORK_RETRY_DELAYS_MS.length + 1;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await performRequest<T>(url, options, body, init);
    } catch (err) {
      lastError = err;
      // Újrapróba CSAK átmeneti hideg-indítás-hibára: (a) nincs válasz
      // (NETWORK_ERROR / "Failed to fetch"), vagy (b) a Render gateway 502/503/504-e
      // ébredés közben. A valódi 4xx/5xx alkalmazás-hibákat azonnal továbbdobjuk.
      const retriable =
        err instanceof ApiError &&
        (err.code === 'NETWORK_ERROR' || COLD_START_STATUSES.has(err.status));
      const hasMore = attempt < maxAttempts - 1;
      if (!retriable || !hasMore) break;
      await sleep(NETWORK_RETRY_DELAYS_MS[attempt]!);
    }
  }
  throw lastError;
}

/**
 * Egyszerre futó ("single-flight") refresh: ha több kérés is 401-et kap az access
 * token lejárta miatt, MIND ugyanarra az egy refresh-hívásra vár, hogy ne
 * forgassuk feleslegesen (és egymást érvénytelenítve) a refresh tokent.
 */
let refreshInFlight: Promise<boolean> | null = null;

function tryRefreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      // A refresh token httpOnly cookie-ban van: a böngésző automatikusan küldi
      // (credentials: 'include'), a kérés body-jában NINCS token. A hívás anonim
      // (nem megy át a refresh-rétegen, különben 401-nél önmagát hívná).
      const tokens = await sendRequest<AuthTokens>('/auth/refresh', {
        method: 'POST',
        anonymous: true,
        credentials: 'include',
        baseUrl: AUTH_BASE_URL,
      });
      setAccessToken(tokens.accessToken, getRememberMe());
      return true;
    } catch {
      // A refresh cookie lejárt/visszavont/hiányzik: tiszta kijelentkeztetés. A
      // következő védett oldal-betöltéskor az AppShell a login oldalra irányít.
      clearTokens();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Core request helper. Returns parsed JSON, or `undefined` for 204.
 *
 * Ha egy védett (nem `anonymous`) kérés 401-et kap és van tárolt refresh token,
 * EGYSZER csendben frissítünk és újrapróbáljuk a kérést. Így a rövid életű access
 * token lejárta nem jelentkezteti ki a felhasználót.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await sendRequest<T>(path, options);
  } catch (err) {
    // A refresh token httpOnly cookie-ban van (JS-ből nem látható), ezért a
    // meglévő access token alapján döntünk: ha van session, megpróbálunk
    // frissíteni (a cookie a böngészővel automatikusan megy a refreshhez).
    const isAuthExpiry =
      err instanceof ApiError &&
      err.status === 401 &&
      !options.anonymous &&
      getAccessToken() !== null;
    if (!isAuthExpiry) throw err;

    const refreshed = await tryRefreshTokens();
    if (!refreshed) throw err;

    // Új access tokennel (a buildHeaders újraolvassa) még egyszer megpróbáljuk.
    return await sendRequest<T>(path, options);
  }
}

// ── Typed endpoint helpers (Phase 1 contracts; backend wiring later) ─────────

export interface LoginPayload {
  email: string;
  password: string;
  /** "Remember me": tartós (eszközön maradó) vagy csak munkamenetnyi belépés. */
  rememberMe: boolean;
}

export interface RegisterPayload {
  companyName: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  password: string;
  rememberMe: boolean;
}

export interface AuthResponse extends AuthTokens {
  user: CurrentUser;
  memberships: TenantMembership[];
}

export const authApi = {
  login(payload: LoginPayload): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      json: payload,
      anonymous: true,
      // credentials: a böngésző fogadja és tárolja a refresh httpOnly cookie-t.
      credentials: 'include',
      baseUrl: AUTH_BASE_URL,
    });
  },
  register(payload: RegisterPayload): Promise<AuthResponse> {
    const { taxId, ...rest } = payload;
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      // A backend `taxNumber` mezőt vár (a DB oszlop neve), a form `taxId`-t használ.
      json: { ...rest, taxNumber: taxId },
      anonymous: true,
      credentials: 'include',
      baseUrl: AUTH_BASE_URL,
    });
  },
  me(): Promise<AuthSession> {
    return apiRequest<AuthSession>('/auth/me');
  },
  /** Jelszó-visszaállítás kérése. A `locale` az e-mail nyelvéhez. */
  forgotPassword(email: string, locale?: string): Promise<{ ok: true }> {
    return apiRequest<{ ok: true }>('/auth/forgot-password', {
      method: 'POST',
      json: locale ? { email, locale } : { email },
      anonymous: true,
    });
  },
  /** Új jelszó beállítása a visszaállító tokennel. */
  resetPassword(token: string, password: string): Promise<{ ok: true }> {
    return apiRequest<{ ok: true }>('/auth/reset-password', {
      method: 'POST',
      json: { token, password },
      anonymous: true,
    });
  },
  /**
   * Kijelentkezés: a refresh token szerveroldali visszavonása. A token a httpOnly
   * cookie-ból jön (credentials: 'include'), nem a body-ból.
   */
  logout(): Promise<void> {
    return apiRequest<void>('/auth/logout', {
      method: 'POST',
      anonymous: true,
      credentials: 'include',
      baseUrl: AUTH_BASE_URL,
    });
  },
};

/**
 * Az access token és az aktív cég eltárolása sikeres bejelentkezés/regisztráció
 * után. A `rememberMe` dönti el a token tárhelyét (localStorage vs sessionStorage);
 * a refresh token a backend által beállított httpOnly cookie-ban van.
 */
export function storeAuth(response: AuthResponse, rememberMe: boolean): void {
  setAccessToken(response.accessToken, rememberMe);
  resolveActiveTenant(response.memberships);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface DocumentListItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  /** AI-osztályozott típus (invoice | registration | compliance | other) vagy null. */
  docType: string | null;
  /** Tartalmi duplikátum esetén az eredeti (felülírható) dokumentum id-je. */
  duplicateOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  name: string;
  category: string;
  partType: string | null;
  type: string;
  vehicleId: string | null;
  quantity: number;
  unitPrice: string | null;
  price: string;
  confidence: number;
}

export interface DocumentInvoice {
  id: string;
  invoiceNumber: string | null;
  date: string | null;
  currency: string | null;
  odometerKm: number | null;
  netTotal: string | null;
  taxTotal: string | null;
  grossTotal: string | null;
  confidence: number;
  extractionRaw: Record<string, unknown> | null;
  supplier: { id: string; name: string } | null;
  items: InvoiceItem[];
}

/** Az eredeti (felülírható) dokumentum összegzése a duplikátum-nézethez. */
export interface DuplicateOriginal {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  invoice: DocumentInvoice | null;
}

export interface DocumentDetail extends DocumentListItem {
  storageKey: string;
  sha256: string;
  invoice: DocumentInvoice | null;
  /** Duplikátum esetén: MIT írna felül (az eredeti dokumentum + számlája). */
  duplicateOf: DuplicateOriginal | null;
}

export const documentsApi = {
  /**
   * Fájl feltöltése EGY kéréssel (multipart). A fájl az API-n keresztül kerül a
   * tárhelyre (szerveroldali feltöltés) – nincs közvetlen böngésző→S3 hívás.
   */
  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<DocumentListItem>('/documents', { method: 'POST', form });
  },
  list() {
    return apiRequest<DocumentListItem[]>('/documents');
  },
  getById(id: string) {
    return apiRequest<DocumentDetail>(`/documents/${id}`);
  },
  getDownloadUrl(id: string) {
    return apiRequest<{ downloadUrl: string }>(`/documents/${id}/download`);
  },
  confirm(id: string) {
    return apiRequest<DocumentListItem>(`/documents/${id}/confirm`, {
      method: 'PATCH',
    });
  },
  /**
   * Duplikátum feloldása felülírással: az új dokumentum felülírja az eredetit
   * (az eredeti törlődik). A duplikátum megtartása nem lehetséges.
   */
  overwriteDuplicate(id: string) {
    return apiRequest<DocumentListItem>(`/documents/${id}/overwrite-duplicate`, {
      method: 'POST',
      json: { action: 'overwrite' },
    });
  },
  /** Teljes törlés: a számla, tételek és a tárolt fájl is törlődik. */
  remove(id: string) {
    return apiRequest<void>(`/documents/${id}`, { method: 'DELETE' });
  },
};

// ── Invoices ────────────────────────────────────────────────────────────────

export interface UpdateInvoiceItemPayload {
  /** Jármű azonosító; `null` = hozzárendelés törlése. */
  vehicleId?: string | null;
  category?: string;
  type?: string;
  partType?: string | null;
}

/** Kézi tétel (tipikusan munkadíj) hozzáadása egy számlához. */
export interface AddInvoiceItemPayload {
  name: string;
  /** A tétel teljes összege. */
  price: number;
  /** Alapból `labor` (munkadíj). */
  category?: string;
  type?: string;
  partType?: string | null;
  vehicleId?: string | null;
  quantity?: number;
  unitPrice?: number;
}

export const invoicesApi = {
  updateItem(itemId: string, payload: UpdateInvoiceItemPayload) {
    return apiRequest<InvoiceItem>(`/invoices/items/${itemId}`, {
      method: 'PATCH',
      json: payload,
    });
  },
  addItem(invoiceId: string, payload: AddInvoiceItemPayload) {
    return apiRequest<InvoiceItem>(`/invoices/${invoiceId}/items`, {
      method: 'POST',
      json: payload,
    });
  },
  deleteItem(itemId: string) {
    return apiRequest<{ id: string }>(`/invoices/items/${itemId}`, {
      method: 'DELETE',
    });
  },
};

// ── Komplex szerviz események ─────────────────────────────────────────────────

export interface MajorComponentEvent {
  id: string;
  vehicleId: string;
  component: string;
  kind: string;
  title: string | null;
  odometerKm: number | null;
  date: string | null;
  partsCost: string | null;
  laborCost: string | null;
  totalCost: string | null;
  currency: string | null;
  invoiceId: string | null;
  itemIds: string[] | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateMajorComponentEventPayload {
  component: string;
  kind?: string;
  title?: string;
  odometerKm?: number;
  date?: string;
  partsCost?: number;
  laborCost?: number;
  currency?: string;
  invoiceId?: string;
  itemIds?: string[];
  notes?: string;
}

export const majorComponentsApi = {
  listForVehicle(vehicleId: string) {
    return apiRequest<MajorComponentEvent[]>(
      `/vehicles/${vehicleId}/major-components`,
    );
  },
  create(vehicleId: string, payload: CreateMajorComponentEventPayload) {
    return apiRequest<MajorComponentEvent>(
      `/vehicles/${vehicleId}/major-components`,
      { method: 'POST', json: payload },
    );
  },
  remove(id: string) {
    return apiRequest<{ id: string }>(`/major-components/${id}`, {
      method: 'DELETE',
    });
  },
};

// ── Tartósság (élettartam-felmérés + előrejelzés) ────────────────────────────

export interface DurabilitySurveyRow {
  segment: string;
  component: string;
  expectedKm: number;
  source: 'manual' | 'empirical' | 'seed';
  sampleCount: number;
  seedKm: number;
  overrideKm: number | null;
}

export interface VehicleComponentForecast {
  component: string;
  lastEventKm: number | null;
  kmSince: number | null;
  expectedKm: number;
  source: 'empirical' | 'seed';
  status: 'ok' | 'watch' | 'due' | 'overdue';
  estimatedNextDueKm: number | null;
  estimatedCost: string | null;
  currency: string | null;
}

export const durabilityApi = {
  forecastForVehicle(vehicleId: string) {
    return apiRequest<VehicleComponentForecast[]>(
      `/vehicles/${vehicleId}/durability`,
    );
  },
  survey() {
    return apiRequest<DurabilitySurveyRow[]>(`/durability/survey`);
  },
  setBaseline(segment: string, component: string, expectedKm: number) {
    return apiRequest<unknown>(`/durability/baselines`, {
      method: 'POST',
      json: { segment, component, expectedKm },
    });
  },
  clearBaseline(segment: string, component: string) {
    return apiRequest<unknown>(
      `/durability/baselines/${segment}/${component}`,
      { method: 'DELETE' },
    );
  },
};

// ── Ranglista ────────────────────────────────────────────────────────────────

export interface VehicleRanking {
  vehicleId: string;
  label: string;
  segment: string;
  makeModel: string;
  currency: string | null;
  totalSpent: string;
  odometerKm: number | null;
  costPerKm: string | null;
  revenuePerKm: string | null;
  profitPerKm: string | null;
  majorEventCount: number;
  bigPartsDue: number;
  economyScore: number;
  replaceAdvice: boolean;
  badges: string[];
}

export interface RankingGroup {
  key: string;
  vehicles: VehicleRanking[];
}

export interface RankingsResult {
  bySegment: RankingGroup[];
  byModel: RankingGroup[];
}

export interface SupplierQualityRow {
  supplierId: string;
  supplierName: string;
  component: string;
  eventCount: number;
  medianCost: string | null;
  currency: string | null;
  medianIntervalKm: number | null;
  intervalSamples: number;
}

export const rankingsApi = {
  get() {
    return apiRequest<RankingsResult>(`/rankings`);
  },
  suppliers() {
    return apiRequest<SupplierQualityRow[]>(`/rankings/suppliers`);
  },
};

// ── Vehicles ──────────────────────────────────────────────────────────────────

/** Egy jármű-fél szerepe és típusa. */
export type VehiclePartyRole = 'owner' | 'user';
export type VehiclePartyType = 'person' | 'company';

/** Tulajdonos (C.2) vagy üzembentartó/lízingbevevő (C.1) – DB-rekord. */
export interface VehicleParty {
  id: string;
  role: VehiclePartyRole;
  partyType: VehiclePartyType;
  name: string | null;
  address: string | null;
  /** CNP (magánszemély) vagy CUI (cég). */
  idNumber: string | null;
}

/** Egy fél írásakor küldött payload (id nélkül). */
export interface VehiclePartyPayload {
  role: VehiclePartyRole;
  partyType?: VehiclePartyType;
  name?: string;
  address?: string;
  idNumber?: string;
}

export interface Vehicle {
  id: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  vehicleType: string | null;
  year: number | null;
  odometerKm: number | null;
  firstRegistration: string | null;
  category: string | null;
  /** Flotta-szegmens KÉZI felülírása; ha null, a forgalmiból vezetjük le. */
  fleetSegment: string | null;
  /** Opcionális bevétel/km a valós rentabilitás ranglistához. */
  revenuePerKm: string | null;
  fuelType: string | null;
  engineCm3: number | null;
  powerKw: number | null;
  color: string | null;
  seats: number | null;
  maxMassKg: number | null;
  kerbWeightKg: number | null;
  euroClass: string | null;
  typeApproval: string | null;
  parties?: VehicleParty[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehiclePayload {
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  vehicleType?: string;
  year?: number;
  odometerKm?: number;
  firstRegistration?: string;
  category?: string;
  fleetSegment?: string;
  revenuePerKm?: number;
  fuelType?: string;
  engineCm3?: number;
  powerKw?: number;
  color?: string;
  seats?: number;
  maxMassKg?: number;
  kerbWeightKg?: number;
  euroClass?: string;
  typeApproval?: string;
  parties?: VehiclePartyPayload[];
}

export interface ServiceHistoryItem extends InvoiceItem {
  invoice: {
    id: string;
    documentId: string;
    invoiceNumber: string | null;
    date: string | null;
    currency: string | null;
    supplier: { id: string; name: string } | null;
  } | null;
}

export interface VehicleServiceHistory {
  vehicle: Vehicle;
  summary: {
    totalSpent: string;
    itemCount: number;
    invoiceCount: number;
    lastServiceDate: string | null;
    currency: string | null;
  };
  items: ServiceHistoryItem[];
}

// ── Jármű forgalmi-beolvasás (OCR + AI) ──────────────────────────────────────

export interface VehicleRegistrationDraft {
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  vehicleType: string | null;
  year: number | null;
  firstRegistration: string | null;
  fuelType: string | null;
  engineCm3: number | null;
  powerKw: number | null;
  color: string | null;
  category: string | null;
  seats: number | null;
  maxMassKg: number | null;
  kerbWeightKg: number | null;
  euroClass: string | null;
  typeApproval: string | null;
  ownerName: string | null;
  ownerAddress: string | null;
  ownerType: string | null;
  ownerIdNumber: string | null;
  userName: string | null;
  userAddress: string | null;
  userType: string | null;
  userIdNumber: string | null;
  confidence: number;
  uncertainFields: { path: string; reason: string; confidence: number }[];
}

export interface ScanFileRef {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** A forgalmi-beolvasás háttér-job állapotai (a shared VehicleScanStatus tükre). */
export type VehicleScanStatus =
  | 'PENDING'
  | 'OCR_RUNNING'
  | 'EXTRACTING'
  | 'DONE'
  | 'FAILED'
  | 'CONFIRMED';

/** A beolvasás indításának eredménye: ezzel pollingol a kliens. */
export interface StartScanResult {
  scanId: string;
  status: VehicleScanStatus;
}

/** Egy beolvasás (job) aktuális állapota és – ha kész – az eredménye. */
export interface VehicleScanView {
  id: string;
  status: VehicleScanStatus;
  draft: VehicleRegistrationDraft | null;
  files: ScanFileRef[];
  matchedVehicleId: string | null;
  looksLikeRegistration: boolean | null;
  error: string | null;
}

export interface ConfirmScanPayload extends CreateVehiclePayload {
  vehicleId?: string;
  /** A beolvasás id-je – mentés után a háttér CONFIRMED-re állítja. */
  scanId?: string;
  files?: ScanFileRef[];
}

/** Egy beolvasás listaeleme (feldolgozási „inbox" sor). */
export interface VehicleScanListItem {
  id: string;
  status: VehicleScanStatus;
  fileName: string;
  fileCount: number;
  plate: string | null;
  matchedVehicleId: string | null;
  looksLikeRegistration: boolean | null;
  error: string | null;
  createdAt: string;
}

export interface VehicleDocumentItem {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface VehicleVerificationView {
  source: string;
  status: string;
  itpValidUntil: string | null;
  rcaValidUntil: string | null;
  vignetteValidUntil: string | null;
  checkedAt: string;
}

export interface ComplianceScanResult {
  type: string;
  validUntil: string | null;
  confidence: number;
  file: ScanFileRef;
}

export interface ImportRowResult {
  index: number;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  odometerKm: number | null;
  action: 'create' | 'update' | 'error';
  vehicleId: string | null;
  errors: string[];
}

export interface ImportPreview {
  rows: ImportRowResult[];
  summary: { total: number; create: number; update: number; error: number };
}

export interface ImportCommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { index: number; message: string }[];
}

export const vehiclesApi = {
  list() {
    return apiRequest<Vehicle[]>('/vehicles');
  },
  /**
   * Forgalmi engedély beolvasásának INDÍTÁSA (1–2 fájl). NEM ment járművet és
   * NEM várja meg az OCR+AI-t: a háttér-feldolgozáshoz sorba teszi, és a
   * `scanId`-t adja vissza. Az eredményre a `getScan`-nel pollingolj.
   */
  scanRegistration(files: File[], locale?: string) {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    return apiRequest<StartScanResult>(`/vehicles/scan${qs}`, {
      method: 'POST',
      form,
    });
  },
  /** A feldolgozási „inbox": a még meg nem erősített beolvasások státusszal. */
  listScans() {
    return apiRequest<VehicleScanListItem[]>('/vehicles/scans');
  },
  /** Egy beolvasás aktuális állapota és – ha kész – az eredménye (polling). */
  getScan(scanId: string) {
    return apiRequest<VehicleScanView>(`/vehicles/scan/${scanId}`);
  },
  /** Egy beolvasás elvetése a feldolgozási listából. */
  deleteScan(scanId: string) {
    return apiRequest<void>(`/vehicles/scan/${scanId}`, { method: 'DELETE' });
  },
  /** A beolvasott (ellenőrzött) adatok mentése. */
  confirmScan(payload: ConfirmScanPayload) {
    return apiRequest<{ id: string }>('/vehicles/scan/confirm', {
      method: 'POST',
      json: payload,
    });
  },
  importPreview(file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<ImportPreview>('/vehicles/import/preview', {
      method: 'POST',
      form,
    });
  },
  importCommit(file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<ImportCommitResult>('/vehicles/import/commit', {
      method: 'POST',
      form,
    });
  },
  verify(id: string) {
    return apiRequest<VehicleVerificationView>(`/vehicles/${id}/verify`, {
      method: 'POST',
    });
  },
  scanComplianceDocument(id: string, type: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<ComplianceScanResult>(
      `/vehicles/${id}/verify-document?type=${encodeURIComponent(type)}`,
      { method: 'POST', form },
    );
  },
  confirmComplianceDocument(
    id: string,
    payload: { type: string; validUntil: string; file: ScanFileRef },
  ) {
    return apiRequest<VehicleVerificationView | null>(
      `/vehicles/${id}/verify-document/confirm`,
      { method: 'POST', json: payload },
    );
  },
  getVerification(id: string) {
    return apiRequest<VehicleVerificationView | null>(
      `/vehicles/${id}/verification`,
    );
  },
  listDocuments(id: string) {
    return apiRequest<VehicleDocumentItem[]>(`/vehicles/${id}/documents`);
  },
  getDocumentDownloadUrl(id: string, docId: string) {
    return apiRequest<{ downloadUrl: string }>(
      `/vehicles/${id}/documents/${docId}/download`,
    );
  },
  getById(id: string) {
    return apiRequest<Vehicle>(`/vehicles/${id}`);
  },
  getHistory(id: string) {
    return apiRequest<VehicleServiceHistory>(`/vehicles/${id}/history`);
  },
  create(payload: CreateVehiclePayload) {
    return apiRequest<Vehicle>('/vehicles', { method: 'POST', json: payload });
  },
  update(id: string, payload: CreateVehiclePayload) {
    return apiRequest<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', json: payload });
  },
  remove(id: string) {
    return apiRequest<void>(`/vehicles/${id}`, { method: 'DELETE' });
  },
};

// ── Reminders (proaktív karbantartás + lejárat-figyelés) ─────────────────────

export type ReminderStatusValue = 'ok' | 'due_soon' | 'overdue';

export interface Reminder {
  id: string;
  vehicleId: string;
  vehicle: {
    id: string;
    plate: string | null;
    make: string | null;
    model: string | null;
    odometerKm: number | null;
  } | null;
  kind: string;
  type: string;
  title: string | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  intervalDays: number | null;
  intervalKm: number | null;
  lastDoneAt: string | null;
  lastDoneKm: number | null;
  notes: string | null;
  active: boolean;
  status: ReminderStatusValue;
  daysRemaining: number | null;
  kmRemaining: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderSuggestion {
  type: string;
  kind: string;
  intervalKm: number | null;
  intervalDays: number | null;
  lastDoneAt: string | null;
  lastDoneKm: number | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  reason: string;
  source: 'learned' | 'default';
  dataPoints: number;
}

export interface CreateReminderPayload {
  vehicleId: string;
  kind: string;
  type: string;
  title?: string;
  dueDate?: string;
  dueOdometerKm?: number;
  intervalDays?: number;
  intervalKm?: number;
  notes?: string;
  active?: boolean;
}

export type UpdateReminderPayload = Partial<Omit<CreateReminderPayload, 'vehicleId'>>;

export const remindersApi = {
  list(vehicleId?: string) {
    const qs = vehicleId ? `?vehicleId=${encodeURIComponent(vehicleId)}` : '';
    return apiRequest<Reminder[]>(`/reminders${qs}`);
  },
  upcoming() {
    return apiRequest<Reminder[]>('/reminders/upcoming');
  },
  suggestions(vehicleId: string) {
    return apiRequest<ReminderSuggestion[]>(`/reminders/suggestions/${vehicleId}`);
  },
  create(payload: CreateReminderPayload) {
    return apiRequest<Reminder>('/reminders', { method: 'POST', json: payload });
  },
  update(id: string, payload: UpdateReminderPayload) {
    return apiRequest<Reminder>(`/reminders/${id}`, {
      method: 'PATCH',
      json: payload,
    });
  },
  complete(id: string, payload: { doneAt?: string; doneKm?: number } = {}) {
    return apiRequest<Reminder>(`/reminders/${id}/complete`, {
      method: 'POST',
      json: payload,
    });
  },
  remove(id: string) {
    return apiRequest<void>(`/reminders/${id}`, { method: 'DELETE' });
  },
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  vehicles: { total: number };
  documents: {
    total: number;
    thisMonth: number;
    needsReview: number;
    processing: number;
    confirmed: number;
  };
  invoices: {
    grossTotal: string | null;
    count: number;
  };
  automation: {
    autoOk: number;
    needsReview: number;
    rate: number;
  };
}

export const statsApi = {
  getDashboard() {
    return apiRequest<DashboardStats>('/stats');
  },
};

// ── Insights (költség-anomáliák) ─────────────────────────────────────────────

export type AnomalyTypeValue =
  | 'price_spike'
  | 'duplicate_invoice'
  | 'unusual_amount';
export type AnomalySeverityValue = 'low' | 'medium' | 'high';

export interface Anomaly {
  id: string;
  type: AnomalyTypeValue;
  severity: AnomalySeverityValue;
  documentId: string | null;
  invoiceId: string | null;
  date: string | null;
  supplier: string | null;
  vehicleLabel: string | null;
  itemName: string | null;
  currency: string | null;
  amount: string | null;
  baseline: string | null;
  deltaPct: number | null;
  count: number | null;
}

export interface AnomalySummary {
  total: number;
  byType: Record<AnomalyTypeValue, number>;
  bySeverity: Record<AnomalySeverityValue, number>;
}

export type TcoRecommendationValue = 'ok' | 'watch' | 'consider_replacement';

export interface VehicleTco {
  vehicleId: string;
  label: string;
  currency: string | null;
  totalSpent: string;
  recentCost: string;
  priorCost: string;
  trendPct: number | null;
  costPerKm: string | null;
  odometerKm: number | null;
  recommendation: TcoRecommendationValue;
}

export const insightsApi = {
  getAnomalies() {
    return apiRequest<Anomaly[]>('/insights/anomalies');
  },
  getSummary() {
    return apiRequest<AnomalySummary>('/insights/anomalies/summary');
  },
  getTco() {
    return apiRequest<VehicleTco[]>('/insights/tco');
  },
};

// ── Benchmark („Európai trendek") ────────────────────────────────────────────

export type BenchmarkPositionValue = 'below' | 'within' | 'above';

export interface BenchmarkComparison {
  makeModel: string;
  itemCategory: string;
  kmBucket: number;
  currency: string;
  tenantMedian: string;
  benchmarkMedian: string;
  deltaPct: number;
  position: BenchmarkPositionValue;
  sampleTenants: number;
  sampleVehicles: number;
}

export interface VehicleRecall {
  reference: string;
  makeModel: string;
  yearFrom: number | null;
  yearTo: number | null;
  hazard: string;
  remedy: string | null;
  source: string;
  publishedAt: string | null;
}

export const benchmarkApi = {
  getComparison() {
    return apiRequest<BenchmarkComparison[]>('/benchmark');
  },
  getRecalls() {
    return apiRequest<VehicleRecall[]>('/benchmark/recalls');
  },
};

// ── Team / users ────────────────────────────────────────────────────────────

export interface TeamMember {
  membershipId: string;
  role: string;
  user: { id: string; email: string; name: string | null };
  createdAt: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt?: string;
}

export const usersApi = {
  listMembers() {
    return apiRequest<TeamMember[]>('/users/members');
  },
  invite(payload: { email: string; role: string }) {
    return apiRequest<PendingInvitation>('/users/invite', {
      method: 'POST',
      json: payload,
    });
  },
  listInvitations() {
    return apiRequest<PendingInvitation[]>('/users/invitations');
  },
  revokeInvitation(id: string) {
    return apiRequest<void>(`/users/invitations/${id}`, { method: 'DELETE' });
  },
  changeRole(membershipId: string, role: string) {
    return apiRequest<{ membershipId: string; role: string }>(
      `/users/members/${membershipId}/role`,
      { method: 'PATCH', json: { role } },
    );
  },
  removeMember(membershipId: string) {
    return apiRequest<void>(`/users/members/${membershipId}`, {
      method: 'DELETE',
    });
  },
};

// ── Reports ─────────────────────────────────────────────────────────────────

export interface ReportRow {
  key: string;
  label: string;
  total: string;
  count: number;
}

export interface MonthRow {
  month: string;
  total: string;
}

export interface ReportSummary {
  totals: {
    grossTotal: string;
    itemTotal: string;
    itemCount: number;
    invoiceCount: number;
    currency: string | null;
  };
  byVehicle: ReportRow[];
  byCategory: ReportRow[];
  byMonth: MonthRow[];
}

export interface ExportRow {
  date: string;
  supplier: string;
  invoiceNumber: string;
  vehicle: string;
  item: string;
  category: string;
  type: string;
  quantity: number;
  unitPrice: string;
  price: string;
  currency: string;
}

function reportQuery(from?: string, to?: string): string {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export const reportsApi = {
  getSummary(from?: string, to?: string) {
    return apiRequest<ReportSummary>(`/reports/summary${reportQuery(from, to)}`);
  },
  getExport(from?: string, to?: string) {
    return apiRequest<ExportRow[]>(`/reports/export${reportQuery(from, to)}`);
  },
};

// ── Admin (platform) ────────────────────────────────────────────────────────

export interface AdminSubscription {
  id?: string;
  planTier: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export interface AdminTenantListItem {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  subscription: AdminSubscription | null;
  counts: { members: number; vehicles: number; documents: number };
}

export interface AdminTenantDetail {
  id: string;
  name: string;
  taxNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  extraStorageGb: number;
  subscription: AdminSubscription | null;
  members: {
    membershipId: string;
    role: string;
    user: { id: string; email: string; name: string | null };
  }[];
  featureOverrides: { key: string; enabled: boolean }[];
  counts: { members: number; vehicles: number; documents: number; invoices: number };
}

/** Platform-szintű számla-/utalási adatok (csak Super Admin szerkeszti). */
export interface BillingSettings {
  companyName: string;
  taxNumber: string;
  address: string;
  beneficiary: string;
  iban: string;
  bankName: string;
  swift: string;
  notifyEmail: string;
}

export const adminApi = {
  listTenants() {
    return apiRequest<AdminTenantListItem[]>('/admin/tenants');
  },
  getTenant(id: string) {
    return apiRequest<AdminTenantDetail>(`/admin/tenants/${id}`);
  },
  setSubscription(id: string, payload: { planTier: string; status: string }) {
    return apiRequest<AdminSubscription>(`/admin/tenants/${id}/subscription`, {
      method: 'PUT',
      json: payload,
    });
  },
  setExtraStorage(id: string, gb: number) {
    return apiRequest<{ id: string; extraStorageGb: number }>(
      `/admin/tenants/${id}/extra-storage`,
      { method: 'PUT', json: { gb } },
    );
  },
  getBillingSettings() {
    return apiRequest<BillingSettings>('/admin/billing-settings');
  },
  setBillingSettings(payload: BillingSettings) {
    return apiRequest<BillingSettings>('/admin/billing-settings', {
      method: 'PUT',
      json: payload,
    });
  },
  sendTestEmail(to: string) {
    return apiRequest<{ ok: boolean; status?: number; error?: string }>(
      '/admin/test-email',
      { method: 'POST', json: { to } },
    );
  },
  setFeature(id: string, key: string, enabled: boolean) {
    return apiRequest<{ key: string; enabled: boolean }>(
      `/admin/tenants/${id}/features/${key}`,
      { method: 'PUT', json: { enabled } },
    );
  },
  removeFeature(id: string, key: string) {
    return apiRequest<void>(`/admin/tenants/${id}/features/${key}`, {
      method: 'DELETE',
    });
  },
};

// ── Billing ─────────────────────────────────────────────────────────────────

export interface BillingOverview {
  plan: string;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  limits: {
    maxVehicles: number;
    maxUsers: number;
    maxDocumentsPerMonth: number;
    maxStorageBytes: number;
  };
  usage: {
    vehicles: number;
    users: number;
    documentsThisMonth: number;
    storageBytes: number;
  };
  /** Vásárolt extra tárhely GB-ban (a csomag-tárhely fölött). */
  extraStorageGb: number;
  features: string[];
}

export interface SubscriptionRequestResult {
  plan: string;
  amount: number;
  currency: string;
  reference: string;
  bank: { beneficiary: string; iban: string; bank: string; swift: string };
  emailedTo: string | null;
}

export const billingApi = {
  getOverview() {
    return apiRequest<BillingOverview>('/billing/overview');
  },
  requestSubscription(planTier: string) {
    return apiRequest<SubscriptionRequestResult>('/billing/request-subscription', {
      method: 'POST',
      json: { planTier },
    });
  },
};

// ── Notifications (Web Push) ────────────────────────────────────────────────

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export const notificationsApi = {
  getVapidKey() {
    return apiRequest<{ publicKey: string; enabled: boolean }>(
      '/notifications/vapid-key',
    );
  },
  subscribe(payload: PushSubscriptionPayload) {
    return apiRequest<{ ok: true }>('/notifications/subscribe', {
      method: 'POST',
      json: payload,
    });
  },
  unsubscribe(endpoint: string) {
    return apiRequest<{ ok: true }>('/notifications/unsubscribe', {
      method: 'POST',
      json: { endpoint },
    });
  },
};
