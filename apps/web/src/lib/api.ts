'use client';

import type { ApiErrorBody, ErrorCode } from '@valloreg/shared';
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

/** SHA-256 hash kiszámítása a fájl ArrayBuffer-éből (Web Crypto API). */
export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
