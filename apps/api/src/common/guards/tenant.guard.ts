import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../prisma/tenant-context.service';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/request-context';

/**
 * Tenant guard:
 *  1) kiolvassa az `x-tenant-id` header-t,
 *  2) a SYSTEM kliensen ellenőrzi, hogy a felhasználónak van membership-je
 *     ebben a cégben (cross-tenant hozzáférés kizárása),
 *  3) betölti a szerepkört, beállítja a request.tenant-et,
 *  4) belép a tenant AsyncLocalStorage kontextusba, így a scoped Prisma kliens
 *     ettől kezdve a kérés tenantId-jára szűr.
 *
 * Mindig a JwtAuthGuard UTÁN fut (a request.user-re támaszkodik).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw AppException.unauthorized();
    }

    const headerValue = request.headers['x-tenant-id'];
    const tenantId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!tenantId) {
      throw AppException.tenantAccessDenied();
    }

    // Membership ellenőrzés a SYSTEM kliensen (még nincs tenant kontextus).
    const membership = await this.prisma.system.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.userId } },
      select: { role: true },
    });

    if (!membership) {
      throw AppException.tenantAccessDenied();
    }

    request.tenant = { tenantId, role: membership.role };

    // Belépés a tenant kontextusba a kérés további feldolgozásához.
    this.tenantContext.enter({
      tenantId,
      userId: user.userId,
      role: membership.role,
    });

    return true;
  }
}
