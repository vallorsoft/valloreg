import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isWithinLimit,
  PLAN_LIMITS,
  PlanTier,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';

/**
 * Jármű CRUD. A Vehicle modell tenant-scope-olt, ezért a scoped Prisma kliens
 * automatikusan szűri/tölti a tenantId-t. A létrehozásnál a csomag jármű-limitjét
 * is kényszerítjük.
 */
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.scoped.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id },
    });
    if (!vehicle) {
      throw AppException.notFound('A jármű nem található.');
    }
    return vehicle;
  }

  /**
   * Jármű szerviztörténete: minden hozzárendelt számlatétel a számla
   * metaadataival (dátum, beszállító, számlaszám), valamint összegzés
   * (összköltség, tétel- és számlaszám, utolsó szerviz dátuma).
   */
  async getServiceHistory(id: string) {
    const vehicle = await this.getById(id); // tenant-scope-olt létezés-ellenőrzés

    const items = await this.prisma.scoped.invoiceItem.findMany({
      where: { vehicleId: id },
      include: {
        invoice: {
          select: {
            id: true,
            documentId: true,
            invoiceNumber: true,
            date: true,
            currency: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Összegzés + legutóbbi szerviz dátuma.
    let totalSpent = new Prisma.Decimal(0);
    let lastServiceDate: Date | null = null;
    const invoiceIds = new Set<string>();
    let currency: string | null = null;
    for (const item of items) {
      totalSpent = totalSpent.add(item.price);
      invoiceIds.add(item.invoiceId);
      const date = item.invoice?.date ?? null;
      if (date && (!lastServiceDate || date > lastServiceDate)) {
        lastServiceDate = date;
      }
      if (!currency && item.invoice?.currency) currency = item.invoice.currency;
    }

    // Legújabb szerviz elöl (számla dátuma, majd a tétel létrehozása szerint).
    const sorted = [...items].sort((a, b) => {
      const da = a.invoice?.date ? new Date(a.invoice.date).getTime() : 0;
      const db = b.invoice?.date ? new Date(b.invoice.date).getTime() : 0;
      if (db !== da) return db - da;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      vehicle,
      summary: {
        totalSpent: totalSpent.toString(),
        itemCount: items.length,
        invoiceCount: invoiceIds.size,
        lastServiceDate,
        currency,
      },
      items: sorted,
    };
  }

  async create(tenantId: string, userId: string, dto: CreateVehicleDto) {
    await this.assertVehicleLimit(tenantId);

    const vehicle = await this.prisma.scoped.vehicle.create({
      // tenantId-t a scoped kliens is injektálja; explicit átadjuk a típus-
      // biztonságért (az érték azonos, így nincs ütközés).
      data: {
        tenantId,
        plate: dto.plate ?? null,
        vin: dto.vin ?? null,
        make: dto.make ?? null,
        model: dto.model ?? null,
        year: dto.year ?? null,
        odometerKm: dto.odometerKm ?? null,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.created',
      resourceType: 'Vehicle',
      resourceId: vehicle.id,
    });

    return vehicle;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateVehicleDto,
  ) {
    await this.getById(id); // tenant-scope-olt létezés-ellenőrzés

    const vehicle = await this.prisma.scoped.vehicle.update({
      where: { id },
      data: {
        plate: dto.plate,
        vin: dto.vin,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        odometerKm: dto.odometerKm,
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.updated',
      resourceType: 'Vehicle',
      resourceId: id,
    });

    return vehicle;
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    await this.getById(id);

    await this.prisma.scoped.vehicle.delete({ where: { id } });

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.deleted',
      resourceType: 'Vehicle',
      resourceId: id,
    });
  }

  /** Csomag jármű-limit ellenőrzése a létrehozás előtt. */
  private async assertVehicleLimit(tenantId: string): Promise<void> {
    const subscription = await this.prisma.system.subscription.findUnique({
      where: { tenantId },
      select: { planTier: true },
    });
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limit = PLAN_LIMITS[planTier].maxVehicles;

    const count = await this.prisma.scoped.vehicle.count();
    if (!isWithinLimit(count, limit)) {
      throw AppException.vehiclesLimitReached();
    }
  }
}
