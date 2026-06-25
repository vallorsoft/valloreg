import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { TenantRole } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';

/**
 * GDPR adatalany-jogok (DSR) szolgáltatás:
 *  - adat-export (hozzáférés / hordozhatóság, art. 15 & 20),
 *  - saját fiók törlése (art. 17),
 *  - cég (tenant) és minden adatának törlése – csak OWNER (art. 17).
 *
 * MINDEN olvasás/írás a SYSTEM (unscoped) kliensen fut, EXPLICIT tenantId
 * szűréssel – így nem függ a request-scope ALS időzítésétől.
 */
@Injectable()
export class DsrService {
  private readonly logger = new Logger(DsrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** A felhasználó + az aktív cég összes adata egy strukturált JSON objektumban. */
  async exportData(
    userId: string,
    tenantId: string,
    requestedByEmail: string,
  ): Promise<Record<string, unknown>> {
    const db = this.prisma.system;

    const [
      user,
      tenant,
      memberships,
      invitations,
      subscription,
      suppliers,
      vehicles,
      documents,
      reminders,
      auditLogs,
    ] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      db.tenant.findUnique({ where: { id: tenantId } }),
      db.membership.findMany({
        where: { tenantId },
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      db.invitation.findMany({ where: { tenantId } }),
      db.subscription.findUnique({ where: { tenantId } }),
      db.supplier.findMany({ where: { tenantId } }),
      db.vehicle.findMany({
        where: { tenantId },
        include: { verification: true, documents: true },
      }),
      db.document.findMany({
        where: { tenantId },
        include: { invoice: { include: { items: true } } },
      }),
      db.reminder.findMany({ where: { tenantId } }),
      db.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
    ]);

    await this.audit.log({
      tenantId,
      userId,
      action: 'dsr.export',
      resourceType: 'Tenant',
      resourceId: tenantId,
    });

    return {
      exportedAt: new Date().toISOString(),
      requestedBy: requestedByEmail,
      note: 'Export GDPR (art. 15 & 20) – date cont utilizator + companie.',
      user,
      tenant,
      members: memberships.map((m) => ({
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        createdAt: m.createdAt,
      })),
      invitations,
      subscription,
      suppliers,
      vehicles,
      documents,
      reminders,
      auditLogs,
    };
  }

  /**
   * Saját fiók törlése. Csak akkor engedélyezett, ha a felhasználó NEM egyetlen
   * OWNER-e egyetlen cégnek sem (különben a cég gazdátlan maradna – előbb a céget
   * kell törölni/átruházni). A User törlése kaszkádol: Membership, RefreshToken,
   * PasswordResetToken, PushSubscription.
   */
  async deleteAccount(
    userId: string,
    password: string,
    ip?: string,
  ): Promise<void> {
    const db = this.prisma.system;
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) {
      throw AppException.unauthorized();
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw AppException.invalidCredentials();
    }

    // Gazdátlan cég elkerülése: ha a felhasználó az EGYETLEN OWNER egy cégnél, tiltjuk.
    const ownerMemberships = await db.membership.findMany({
      where: { userId, role: TenantRole.OWNER },
      select: { tenantId: true },
    });
    for (const m of ownerMemberships) {
      const owners = await db.membership.count({
        where: { tenantId: m.tenantId, role: TenantRole.OWNER },
      });
      if (owners <= 1) {
        throw AppException.validation(
          'Ești singurul proprietar (OWNER) al unei companii. Șterge sau transferă mai întâi compania, apoi contul.',
        );
      }
    }

    await this.audit.log({
      userId,
      action: 'dsr.account_deleted',
      resourceType: 'User',
      resourceId: userId,
      ip,
      metadata: { email: user.email },
    });

    await db.user.delete({ where: { id: userId } });
  }

  /**
   * Cég (tenant) és MINDEN adatának törlése. Csak OWNER hívhatja (controller
   * RolesGuard). A Tenant törlése kaszkádol minden üzleti rekordra; utána az
   * S3 objektumokat is töröljük (dokumentum-kulcsok + a tenant-prefix).
   */
  async deleteTenant(
    tenantId: string,
    actingUserId: string,
    password: string,
    ip?: string,
  ): Promise<void> {
    const db = this.prisma.system;
    const user = await db.user.findUnique({
      where: { id: actingUserId },
      select: { passwordHash: true, email: true },
    });
    if (!user) {
      throw AppException.unauthorized();
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw AppException.invalidCredentials();
    }

    // A törlés ELŐTT összegyűjtjük az S3 kulcsokat (a kaszkád törlés után már nem lennének).
    const [docs, vehicleDocs] = await Promise.all([
      db.document.findMany({
        where: { tenantId },
        select: { storageKey: true },
      }),
      db.vehicleDocument.findMany({
        where: { tenantId },
        select: { storageKey: true },
      }),
    ]);

    await db.tenant.delete({ where: { id: tenantId } });

    // S3 takarítás – best-effort (a DB törlés már megtörtént, ezt nem visszük vissza).
    const keys = [
      ...docs.map((d) => d.storageKey),
      ...vehicleDocs.map((d) => d.storageKey),
    ].filter(Boolean);
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (err) {
        this.logger.warn(
          `S3 objektum törlése sikertelen (${key}): ${(err as Error).message}`,
        );
      }
    }
    try {
      await this.storage.deleteByPrefix(`tenants/${tenantId}/`);
    } catch (err) {
      this.logger.warn(
        `S3 prefix-takarítás sikertelen (tenants/${tenantId}/): ${(err as Error).message}`,
      );
    }

    // A tenant audit logjai a kaszkáddal törlődtek – platform-szintű rekordot írunk.
    await this.audit.log({
      tenantId: null,
      userId: actingUserId,
      action: 'dsr.tenant_deleted',
      resourceType: 'Tenant',
      resourceId: tenantId,
      ip,
      metadata: { deletedObjects: keys.length },
    });
  }
}
