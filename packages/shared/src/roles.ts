/**
 * Szerepkörök – egy cégen (tenant) belüli RBAC és platform-szintű hozzáférés.
 * A backend RBAC guard és a frontend jogosultság-ellenőrzés ezeket használja.
 */

/** Cégen belüli szerepkörök (a spec szerint). */
export const TenantRole = {
  /** Tulajdonos – teljes hozzáférés a cég adataihoz, billing, felhasználók. */
  OWNER: 'OWNER',
  /** Flottamenedzser – járművek, számlák, szervizkönyv kezelése. */
  FLEET_MANAGER: 'FLEET_MANAGER',
  /** Adminisztrátor – felhasználók, beállítások, support access. */
  ADMIN: 'ADMIN',
  /** Könyvelő – költségek, riportok, export (csak pénzügyi nézet). */
  ACCOUNTANT: 'ACCOUNTANT',
  /** Megtekintő – csak olvasás. */
  VIEWER: 'VIEWER',
} as const;

export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

/** Platform-szintű szerepkör (üzemeltető). NEM tenant-tag. */
export const PlatformRole = {
  /** Super Admin – cégek, előfizetések, feature flag-ek; üzleti adatot NEM lát. */
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const ALL_TENANT_ROLES: readonly TenantRole[] = Object.values(TenantRole);

/**
 * Szerepkör-rangsor a "legalább ilyen jogú" típusú ellenőrzésekhez.
 * Magasabb szám = több jog.
 */
export const TENANT_ROLE_RANK: Record<TenantRole, number> = {
  [TenantRole.VIEWER]: 1,
  [TenantRole.ACCOUNTANT]: 2,
  [TenantRole.FLEET_MANAGER]: 3,
  [TenantRole.ADMIN]: 4,
  [TenantRole.OWNER]: 5,
};

/** Igaz, ha a `role` legalább `required` rangú. */
export function hasAtLeastRole(role: TenantRole, required: TenantRole): boolean {
  return TENANT_ROLE_RANK[role] >= TENANT_ROLE_RANK[required];
}
