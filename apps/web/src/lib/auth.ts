'use client';

import type { TenantRole } from '@valloreg/shared';

/**
 * Client-side auth helpers.
 *
 * Token storage uses localStorage for Phase 1 simplicity. A later phase should
 * move refresh tokens to httpOnly cookies for stronger XSS resistance.
 */

const ACCESS_TOKEN_KEY = 'valloreg.accessToken';
const REFRESH_TOKEN_KEY = 'valloreg.refreshToken';
const ACTIVE_TENANT_KEY = 'valloreg.activeTenantId';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Minimal membership shape (a user can belong to several tenants). */
export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
}

/** Current authenticated user as returned by the API. */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
}

/** The `/auth/me` (and login/register) session payload. */
export interface AuthSession {
  user: CurrentUser;
  memberships: TenantMembership[];
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ── Token storage ──────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(ACTIVE_TENANT_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

// ── Active tenant selection ─────────────────────────────────────────────────

export function getActiveTenantId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_TENANT_KEY);
}

export function setActiveTenantId(tenantId: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
}

/**
 * Resolve the active tenant from the user's memberships, falling back to the
 * first membership and persisting it.
 */
export function resolveActiveTenant(
  memberships: TenantMembership[],
): TenantMembership | null {
  if (memberships.length === 0) return null;
  const storedId = getActiveTenantId();
  const stored = memberships.find((m) => m.tenantId === storedId);
  if (stored) return stored;
  const first = memberships[0]!;
  setActiveTenantId(first.tenantId);
  return first;
}
