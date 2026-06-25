import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { AppException } from '../common/exceptions/app.exception';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

/**
 * Cég (tenant) műveletek. A Tenant modell PK-ja az `id` (nem `tenantId`), ezért
 * a Prisma tenant-scope NEM vonatkozik rá – itt EXPLICITEN az aktív tenant
 * id-jére dolgozunk (a controller a request.tenant-ból adja).
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async getById(tenantId: string) {
    const tenant = await this.prisma.system.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: {
          select: {
            planTier: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
      },
    });
    if (!tenant) {
      throw AppException.tenantNotFound();
    }
    return tenant;
  }

  async update(tenantId: string, userId: string, dto: UpdateTenantDto) {
    const existing = await this.prisma.system.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.tenantNotFound();
    }

    const updated = await this.prisma.system.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name,
        taxNumber: dto.taxNumber,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'tenant.updated',
      resourceType: 'Tenant',
      resourceId: tenantId,
    });

    return updated;
  }

  /**
   * Cég (tenant) TELJES törlése – GDPR art. 17 (jog a törléshez). Csak OWNER
   * hívhatja (a controller RolesGuard-ja kényszeríti).
   *
   * Sorrend:
   *  1) az audit bejegyzést MÉG a törlés előtt rögzítjük (utána a cascade vinné),
   *  2) a tárolt fájlok törlése a `tenants/{tenantId}/` prefix alól (R2/S3),
   *  3) a Tenant rekord törlése – a séma cascade-je viszi az összes kapcsolódó
   *     üzleti adatot (járművek, dokumentumok, számlák, emlékeztetők, audit stb.).
   *
   * Megjegyzés: a globális `User` rekordok NEM törlődnek (több céghez tartozhatnak);
   * a céghez kötött tagság (Membership) viszont a cascade-del megszűnik.
   */
  async deleteTenant(tenantId: string, userId: string): Promise<{ deletedObjects: number }> {
    const existing = await this.prisma.system.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw AppException.tenantNotFound();
    }

    // 1) Audit a törlés ELŐTT (a cascade utána már nem hagyná meg).
    await this.audit.log({
      tenantId,
      userId,
      action: 'tenant.deleted',
      resourceType: 'Tenant',
      resourceId: tenantId,
    });

    // 2) Tárolt fájlok törlése (best-effort: ha a tár hibázik, a DB törlés a
    //    mérvadó; az árva fájlok később takaríthatók).
    let deletedObjects = 0;
    try {
      deletedObjects = await this.storage.deleteByPrefix(`tenants/${tenantId}/`);
    } catch (err) {
      this.logger.warn(
        `A cég fájljainak törlése sikertelen (tenant=${tenantId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // 3) DB törlés – a séma cascade-je viszi a kapcsolódó rekordokat.
    await this.prisma.system.tenant.delete({ where: { id: tenantId } });

    return { deletedObjects };
  }
}
