import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

/**
 * Cég (tenant) műveletek. A Tenant modell PK-ja az `id` (nem `tenantId`), ezért
 * a Prisma tenant-scope NEM vonatkozik rá – itt EXPLICITEN az aktív tenant
 * id-jére dolgozunk (a controller a request.tenant-ból adja).
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
}
