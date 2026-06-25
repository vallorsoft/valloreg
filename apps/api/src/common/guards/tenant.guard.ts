import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { TenantRole } from '@valloreg/shared';
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
 * Kivétel: ha nincs tagság, de a felhasználó platform-admin ÉS van rá szóló élő
 * support-grant, ideiglenes, CSAK OLVASHATÓ (VIEWER), idő-korlátos hozzáférést kap.
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

    if (membership) {
      // Normál cég-tag útvonal – VÁLTOZATLAN: a tagság szerepkörével dolgozunk.
      request.tenant = { tenantId, role: membership.role };

      // A middleware által megnyitott ALS holder feltöltése. A guard ugyanazon az
      // async láncon fut, mint a middleware next()-je, így a beállított érték a
      // handlerben és a scoped Prisma kliensben is látszik.
      this.tenantContext.set({
        tenantId,
        userId: user.userId,
        role: membership.role,
      });

      return true;
    }

    // Support-hozzáférés útvonal: ha NINCS tagság, de a felhasználó platform-admin
    // ÉS van rá szóló ÉLŐ (ACTIVE, nem visszavont, le nem járt) grant, akkor
    // ideiglenes, CSAK OLVASHATÓ (VIEWER) hozzáférést kap. A grant idő-korlátos és
    // auditált; a VIEWER szerepkör tiltja az írást. A query-t itt, inline futtatjuk
    // (PrismaService) – a SupportAccessService-re NEM hivatkozunk, mert a TenantGuard
    // széles körben (a SupportAccessController-ben is) használt, és a függés kör-
    // hivatkozást okozna.
    if (user.isPlatformAdmin) {
      const grant = await this.prisma.system.supportAccess.findFirst({
        where: {
          tenantId,
          status: 'ACTIVE',
          revokedAt: null,
          expiresAt: { gt: new Date() },
          OR: [
            { grantedToEmail: user.email.toLowerCase() },
            { grantedToUserId: user.userId },
          ],
        },
        select: { id: true },
      });

      if (grant) {
        request.tenant = { tenantId, role: TenantRole.VIEWER };
        this.tenantContext.set({
          tenantId,
          userId: user.userId,
          role: TenantRole.VIEWER,
        });
        return true;
      }
    }

    // Sem tagság, sem érvényes support-grant → tiltás.
    throw AppException.tenantAccessDenied();
  }
}
