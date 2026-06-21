import { SetMetadata } from '@nestjs/common';
import type { TenantRole } from '@valloreg/shared';

export const ROLES_KEY = 'roles';

/**
 * A végpont eléréséhez legalább az egyik megadott cég-szerepkör szükséges.
 * A RolesGuard a kérés membership-szerepkörét ellenőrzi ellene.
 */
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
