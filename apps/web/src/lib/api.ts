'use client';

import type { ApiErrorBody, ErrorCode } from '@valloreg/shared';
import {
  getAccessToken,
  getActiveTenantId,
  setTokens,
  type AuthTokens,
  type CurrentUser,
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
      body: json !== undefined ? JSON.stringify(json) : init.body,
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
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      json: payload,
      anonymous: true,
    });
  },
  me(): Promise<CurrentUser> {
    return apiRequest<CurrentUser>('/auth/me');
  },
};

/** Persist tokens after a successful auth call. */
export function storeAuth(response: AuthResponse): void {
  setTokens({
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
  });
}
