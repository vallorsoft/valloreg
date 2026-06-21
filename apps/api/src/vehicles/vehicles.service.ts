import { Injectable } from '@nestjs/common';
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

  async create(tenantId: string, userId: string, dto: CreateVehicleDto) {
    await this.assertVehicleLimit(tenantId);

    const vehicle = await this.prisma.scoped.vehicle.create({
      data: {
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
