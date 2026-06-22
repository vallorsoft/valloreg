'use client';

import { ErrorCode } from '@valloreg/shared';
import type { ApiErrorBody } from '@valloreg/shared';
import {
  getAccessToken,
  getActiveTenantId,
  setTokens,
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
 *
 * TODO (later phase): automatic refresh-token rotation on 401.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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
  /** Skip attaching the Authorization header (e.g. login/register). */
  anonymous?: boolean;
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers);
  if (options.json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
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

/** Core request helper. Returns parsed JSON, or `undefined` for 204. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, anonymous: _anonymous, ...init } = options;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: buildHeaders(options),
      body: json !== undefined ? JSON.stringify(json) : undefined,
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

// ── Typed endpoint helpers (Phase 1 contracts; backend wiring later) ─────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  companyName: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  password: string;
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
    });
  },
  register(payload: RegisterPayload): Promise<AuthResponse> {
    const { taxId, ...rest } = payload;
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      // A backend `taxNumber` mezőt vár (a DB oszlop neve), a form `taxId`-t használ.
      json: { ...rest, taxNumber: taxId },
      anonymous: true,
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
};

/** Persist tokens and select the active tenant after a successful auth call. */
export function storeAuth(response: AuthResponse): void {
  setTokens({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  });
  resolveActiveTenant(response.memberships);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface DocumentListItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
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

export interface DocumentDetail extends DocumentListItem {
  storageKey: string;
  sha256: string;
  invoice: DocumentInvoice | null;
}

export const documentsApi = {
  presign(payload: { fileName: string; mimeType: string }) {
    return apiRequest<{ documentId: string; storageKey: string; uploadUrl: string }>(
      '/documents/presign',
      { method: 'POST', json: payload },
    );
  },
  register(payload: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    sha256: string;
  }) {
    return apiRequest<DocumentListItem>('/documents', {
      method: 'POST',
      json: payload,
    });
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
};

// ── Invoices ────────────────────────────────────────────────────────────────

export interface UpdateInvoiceItemPayload {
  /** Jármű azonosító; `null` = hozzárendelés törlése. */
  vehicleId?: string | null;
  category?: string;
  type?: string;
  partType?: string | null;
}

export const invoicesApi = {
  updateItem(itemId: string, payload: UpdateInvoiceItemPayload) {
    return apiRequest<InvoiceItem>(`/invoices/items/${itemId}`, {
      method: 'PATCH',
      json: payload,
    });
  },
};

/**
 * SHA-256 hash kiszámítása a fájl ArrayBuffer-éből.
 *
 * Elsődlegesen a Web Crypto API-t használja, de a `crypto.subtle` CSAK biztonságos
 * kontextusban (HTTPS vagy localhost) érhető el. Nem biztonságos kontextusban (pl.
 * HTTP, LAN-IP-ről elért telepítés) `crypto.subtle` `undefined`, és a feltöltés
 * korábban néma „Váratlan hiba”-val bukott el. Ilyenkor tiszta JS fallbackre váltunk.
 */
export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return sha256Hex(bytes);
}

/**
 * Tiszta JS SHA-256 (FIPS 180-4) a `computeSha256` fallbackjeként, ha a Web Crypto
 * nem érhető el. Azonos kimenetet ad, így a szerveroldali (tenantId, sha256)
 * idempotencia változatlanul működik.
 */
function sha256Hex(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  const len = bytes.length;
  const bitLen = len * 8;
  const blocks = ((len + 8) >> 6) + 1;
  const total = blocks * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  // 64 bites big-endian hossz; a 32 bites bitműveletek miatt hi/lo bontásban.
  dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(total - 4, bitLen >>> 0);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  // A nem-null assertionök (!) biztonságosak: minden index garantáltan a
  // tartományon belül van, viszont a `noUncheckedIndexedAccess` miatt kellenek.
  let a = H[0]!;
  let b = H[1]!;
  let c = H[2]!;
  let d = H[3]!;
  let e = H[4]!;
  let f = H[5]!;
  let g = H[6]!;
  let h = H[7]!;

  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15]!;
      const w2 = w[t - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    a = H[0]!;
    b = H[1]!;
    c = H[2]!;
    d = H[3]!;
    e = H[4]!;
    f = H[5]!;
    g = H[6]!;
    h = H[7]!;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0;
    H[1] = (H[1]! + b) >>> 0;
    H[2] = (H[2]! + c) >>> 0;
    H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0;
    H[5] = (H[5]! + f) >>> 0;
    H[6] = (H[6]! + g) >>> 0;
    H[7] = (H[7]! + h) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) hex += H[i]!.toString(16).padStart(8, '0');
  return hex;
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  odometerKm: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehiclePayload {
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  odometerKm?: number;
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

export const vehiclesApi = {
  list() {
    return apiRequest<Vehicle[]>('/vehicles');
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
}

export const statsApi = {
  getDashboard() {
    return apiRequest<DashboardStats>('/stats');
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
  subscription: AdminSubscription | null;
  members: {
    membershipId: string;
    role: string;
    user: { id: string; email: string; name: string | null };
  }[];
  featureOverrides: { key: string; enabled: boolean }[];
  counts: { members: number; vehicles: number; documents: number; invoices: number };
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
  usage: { vehicles: number; users: number; documentsThisMonth: number };
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
