import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { GrantSupportAccessDto } from './dto/grant-support-access.dto';

/** A grant élettartamok másodpercben (a DTO `duration` mezőjéhez). */
const DURATION_SECONDS: Record<GrantSupportAccessDto['duration'], number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
};

/**
 * Support-hozzáférés kezelése: ideiglenes, auditált, idő-korlátos hozzáférés egy
 * céghez egy megnevezett support-személy számára.
 *
 * A SYSTEM klienssel dolgozunk: a support-hozzáférés a tenant-határok KÖRÜL
 * mozog (a kedvezményezett platform-admin, nem cég-tag), ezért a scoped kliens
 * nem alkalmazható. A tenantId-t mindenhol expliciten átadjuk és szűrünk rá.
 */
@Injectable()
export class SupportAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Új support-hozzáférés megadása. A lejárat = most + a kiválasztott élettartam.
   * A kedvezményezett email-t normalizáljuk (lowercase + trim).
   */
  async grant(
    tenantId: string,
    grantedByUserId: string,
    dto: GrantSupportAccessDto,
  ) {
    const grantedToEmail = dto.grantedToEmail.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + DURATION_SECONDS[dto.duration] * 1000);

    const access = await this.prisma.system.supportAccess.create({
      data: {
        tenantId,
        grantedByUserId,
        grantedToEmail,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    await this.audit.log({
      tenantId,
      userId: grantedByUserId,
      action: 'support_access.granted',
      resourceType: 'SupportAccess',
      resourceId: access.id,
      metadata: { grantedToEmail, expiresAt: expiresAt.toISOString() },
    });

    return access;
  }

  /**
   * A cég összes support-hozzáférése (legújabb elöl). A TÉNYLEGES állapotot
   * olvasáskor számoljuk: a tárolt `status` lejárat/visszavonás esetén lehet
   * elavult (az EXPIRED-re billentés külön takarító lépés feladata).
   */
  async list(tenantId: string) {
    const now = new Date();
    const rows = await this.prisma.system.supportAccess.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const effectiveStatus = row.revokedAt
        ? 'REVOKED'
        : row.expiresAt <= now
          ? 'EXPIRED'
          : row.status;
      return {
        id: row.id,
        grantedToEmail: row.grantedToEmail,
        grantedByUserId: row.grantedByUserId,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
        effectiveStatus,
      };
    });
  }

  /**
   * Support-hozzáférés visszavonása. Feltételes `updateMany`-vel kerüljük a
   * TOCTOU dupla-visszavonást: csak akkor billentünk, ha a sor még ACTIVE és
   * nem visszavont. `count === 0` esetén már nem létezik aktívként → notFound.
   */
  async revoke(tenantId: string, id: string, userId: string) {
    const result = await this.prisma.system.supportAccess.updateMany({
      where: { id, tenantId, status: 'ACTIVE', revokedAt: null },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    if (result.count === 0) {
      // Már visszavonva / lejárt / nem létezik – nem fedünk fel többet.
      throw AppException.notFound();
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'support_access.revoked',
      resourceType: 'SupportAccess',
      resourceId: id,
    });

    return { revoked: true };
  }

  /**
   * A TenantGuard használja: az adott céghez tartozó ÉLŐ grant megkeresése a
   * kedvezményezett alapján (email VAGY userId egyezés). Élő = ACTIVE, nem
   * visszavont, még nem járt le. Nincs találat → null.
   */
  async findActiveGrant(tenantId: string, email: string, userId: string) {
    return this.prisma.system.supportAccess.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        revokedAt: null,
        expiresAt: { gt: new Date() },
        OR: [
          { grantedToEmail: email.toLowerCase() },
          { grantedToUserId: userId },
        ],
      },
    });
  }
}
