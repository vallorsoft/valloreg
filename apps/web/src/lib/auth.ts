'use client';

import type { TenantRole } from '@valloreg/shared';

/**
 * Client-side auth helpers.
 *
 * A REFRESH token NEM a JS számára elérhető tárban van, hanem httpOnly cookie-ban
 * (a backend állítja be) – így XSS esetén sem olvasható ki. Itt csak a rövid
 * életű ACCESS tokent tároljuk:
 *  - "Remember me" bepipálva → localStorage (túléli a böngésző újraindítását),
 *  - kipipálatlanul → sessionStorage (a böngésző bezárásakor törlődik).
 */

const ACCESS_TOKEN_KEY = 'valloreg.accessToken';
const REMEMBER_KEY = 'valloreg.remember';
const ACTIVE_TENANT_KEY = 'valloreg.activeTenantId';

/** A login/refresh által visszaadott token (a refresh token cookie-ban van). */
export interface AuthTokens {
  accessToken: string;
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
  return (
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
    window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

/** A "Remember me" választás (a tárhely megválasztásához). Alap: true. */
export function getRememberMe(): boolean {
  if (!isBrowser()) return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== '0';
}

/**
 * Az access token mentése. `remember` dönti el a tárat: localStorage (tartós)
 * vagy sessionStorage (a böngésző bezárásáig). A másik tárból töröljük, hogy ne
 * maradjon elárvult token.
 */
export function setAccessToken(accessToken: string, remember: boolean): void {
  if (!isBrowser()) return;
  const primary = remember ? window.localStorage : window.sessionStorage;
  const other = remember ? window.sessionStorage : window.localStorage;
  primary.setItem(ACCESS_TOKEN_KEY, accessToken);
  other.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
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
