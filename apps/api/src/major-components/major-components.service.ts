import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MajorEventKind } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { CreateMajorComponentEventDto } from './dto/create-major-component-event.dto';

/**
 * Nagy alkatrész események (fődarab csere / felújítás) kezelése. Minden
 * lekérdezés tenant-scope-olt (scoped kliens). A „felújítás-összerakás" a
 * megadott számlatételek árát összegzi alkatrész-költséggé.
 */
@Injectable()
export class MajorComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Egy jármű nagy-alkatrész idővonala (legújabb elöl). */
  async listForVehicle(vehicleId: string) {
    await this.assertVehicle(vehicleId);
    return this.prisma.scoped.majorComponentEvent.findMany({
      where: { vehicleId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    userId: string,
    vehicleId: string,
    dto: CreateMajorComponentEventDto,
  ) {
    await this.assertVehicle(vehicleId);

    // „Felújítás-összerakás": a megadott tételek árának összege = alkatrész-
    // költség (ha nincs explicit partsCost), és a számla pénzneme/dátuma átvéve.
    let partsCost = dto.partsCost;
    let currency = dto.currency ?? null;
    let date = dto.date ? new Date(dto.date) : null;
    let invoiceId = dto.invoiceId ?? null;

    if (dto.itemIds && dto.itemIds.length > 0) {
      const items = await this.prisma.scoped.invoiceItem.findMany({
        where: { id: { in: dto.itemIds } },
        include: { invoice: { select: { id: true, currency: true, date: true } } },
      });
      if (items.length === 0) {
        throw AppException.notFound('A kijelölt számlatételek nem találhatók.');
      }
      if (partsCost == null) {
        const sum = items.reduce(
          (acc, it) => acc.add(it.price),
          new Prisma.Decimal(0),
        );
        partsCost = Number(sum);
      }
      const first = items[0]?.invoice ?? null;
      if (!currency) currency = first?.currency ?? null;
      if (!date) date = first?.date ?? null;
      if (!invoiceId) invoiceId = first?.id ?? null;
    }

    const partsDec = partsCost != null ? new Prisma.Decimal(partsCost) : null;
    const laborDec = dto.laborCost != null ? new Prisma.Decimal(dto.laborCost) : null;
    const totalDec =
      partsDec != null || laborDec != null
        ? (partsDec ?? new Prisma.Decimal(0)).add(laborDec ?? new Prisma.Decimal(0))
        : null;

    const created = await this.prisma.scoped.majorComponentEvent.create({
      data: {
        tenantId,
        vehicleId,
        component: dto.component,
        kind: dto.kind ?? MajorEventKind.REPLACEMENT,
        title: dto.title ?? null,
        odometerKm: dto.odometerKm ?? null,
        date,
        partsCost: partsDec,
        laborCost: laborDec,
        totalCost: totalDec,
        currency,
        invoiceId,
        itemIds: dto.itemIds && dto.itemIds.length > 0 ? dto.itemIds : Prisma.JsonNull,
        notes: dto.notes ?? null,
        createdById: userId,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'major_component_event.created',
      resourceType: 'MajorComponentEvent',
      resourceId: created.id,
      metadata: { vehicleId, component: dto.component, kind: created.kind },
    });

    return created;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const event = await this.prisma.scoped.majorComponentEvent.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!event) {
      throw AppException.notFound('A nagy alkatrész esemény nem található.');
    }
    await this.prisma.scoped.majorComponentEvent.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      userId,
      action: 'major_component_event.deleted',
      resourceType: 'MajorComponentEvent',
      resourceId: id,
    });
    return { id };
  }

  /** Tenant-scope-olt létezés-ellenőrzés a járműre. */
  private async assertVehicle(vehicleId: string): Promise<void> {
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle) {
      throw AppException.notFound('A jármű nem található.');
    }
  }
}
