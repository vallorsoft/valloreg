import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TenantRole } from '@valloreg/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/request-context';

/**
 * RBAC guard. A @Roles(...) metaadatot veti össze a kérés membership
 * szerepkörével. Ha nincs @Roles a végponton, átengedi.
 *
 * A TenantGuard UTÁN fut (a request.tenant.role-ra támaszkodik).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenant = request.tenant;

    if (!tenant) {
      throw AppException.tenantAccessDenied();
    }

    if (!requiredRoles.includes(tenant.role)) {
      throw AppException.forbidden(
        'A szerepköröd nem elegendő ehhez a művelethez.',
      );
    }

    return true;
  }
}
