import type { TenantRole } from '@valloreg/shared';

/**
 * A JWT-ből feloldott felhasználó, amit a JwtStrategy.validate tesz a request-re
 * (`request.user`).
 */
export interface AuthUser {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
}

/**
 * Az aktív tenant kontextus, amit a TenantGuard tesz a request-re
 * (`request.tenant`), miután ellenőrizte a membership-et.
 */
export interface ActiveTenant {
  tenantId: string;
  role: TenantRole;
}

/**
 * Express Request a Valloreg-specifikus mezőkkel kibővítve.
 */
export interface AuthenticatedRequest {
  user?: AuthUser;
  tenant?: ActiveTenant;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}
