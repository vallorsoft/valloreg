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
  /** Multipart body (fájlfeltöltés). A Content-Type-ot a böngésző állítja be. */
  form?: FormData;
  /** Skip attaching the Authorization header (e.g. login/register). */
  anonymous?: boolean;
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

/** Core request helper. Returns parsed JSON, or `undefined` for 204. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, form, anonymous: _anonymous, ...init } = options;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const body =
    form !== undefined
      ? form
      : json !== undefined
        ? JSON.stringify(json)
        : undefined;

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

export const invoicesApi = {
  updateItem(itemId: string, payload: UpdateInvoiceItemPayload) {
    return apiRequest<InvoiceItem>(`/invoices/items/${itemId}`, {
      method: 'PATCH',
      json: payload,
    });
  },
};

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
