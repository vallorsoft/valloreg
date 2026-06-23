import { Inject, Injectable, Logger } from '@nestjs/common';
import { ReminderKind, ReminderType } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import {
  VEHICLE_VERIFICATION_PROVIDER,
  type VehicleVerificationData,
  type VehicleVerificationProvider,
} from './verification.provider';

export interface VerificationView {
  source: string;
  status: string;
  itpValidUntil: string | null;
  rcaValidUntil: string | null;
  vignetteValidUntil: string | null;
  checkedAt: string;
}

/** A lejárat-mező → emlékeztető-típus leképezés. */
const FIELD_TO_TYPE: {
  field: keyof Pick<
    VehicleVerificationData,
    'itpValidUntil' | 'rcaValidUntil' | 'vignetteValidUntil'
  >;
  type: ReminderType;
}[] = [
  { field: 'itpValidUntil', type: ReminderType.INSPECTION },
  { field: 'rcaValidUntil', type: ReminderType.INSURANCE },
  { field: 'vignetteValidUntil', type: ReminderType.VIGNETTE },
];

/**
 * RO megfelelőség-ellenőrzés (ITP/RCA/rovinietă). A providertől kapott
 * lejáratokat eltárolja (VehicleVerification) és AUTOMATIKUSAN feltölti a
 * megfelelő compliance emlékeztetők lejáratát (source="verification"), amelyekre
 * a meglévő napi szkenner küld push/e-mail értesítést.
 *
 * Minden írás a SYSTEM klienssel, EXPLICIT tenantId-vel megy (a háttér-ütemező
 * nincs request-kontextusban; a manuális hívásnál a controller adja a tenantId-t).
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(VEHICLE_VERIFICATION_PROVIDER)
    private readonly provider: VehicleVerificationProvider,
  ) {}

  /** Egy jármű manuális ellenőrzése (tenant-scope-olt létezés-ellenőrzéssel). */
  async verify(
    tenantId: string,
    userId: string,
    vehicleId: string,
  ): Promise<VerificationView> {
    const vehicle = await this.prisma.system.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
      select: { id: true, plate: true, vin: true },
    });
    if (!vehicle) throw AppException.notFound('A jármű nem található.');

    const view = await this.doVerify(tenantId, vehicle);

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.verified',
      resourceType: 'Vehicle',
      resourceId: vehicleId,
      metadata: { status: view.status, source: view.source },
    });

    return view;
  }

  /** A legutóbbi ellenőrzés eredménye (scoped olvasás). */
  async getLatest(vehicleId: string): Promise<VerificationView | null> {
    const v = await this.prisma.scoped.vehicleVerification.findFirst({
      where: { vehicleId },
    });
    if (!v) return null;
    return {
      source: v.source,
      status: v.status,
      itpValidUntil: v.itpValidUntil?.toISOString() ?? null,
      rcaValidUntil: v.rcaValidUntil?.toISOString() ?? null,
      vignetteValidUntil: v.vignetteValidUntil?.toISOString() ?? null,
      checkedAt: v.checkedAt.toISOString(),
    };
  }

  /** Háttér-ütemező: minden RO-rendszámú jármű ellenőrzése. */
  async verifyAllRo(): Promise<{ checked: number }> {
    const vehicles = await this.prisma.system.vehicle.findMany({
      select: { id: true, tenantId: true, plate: true, vin: true },
    });
    let checked = 0;
    for (const v of vehicles) {
      if (!isRoPlate(v.plate)) continue;
      try {
        await this.doVerify(v.tenantId, v);
        checked++;
      } catch (err) {
        this.logger.warn(
          `RO ellenőrzés sikertelen (${v.id}): ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`RO megfelelőség-ellenőrzés kész: ${checked} jármű.`);
    return { checked };
  }

  /** A tényleges ellenőrzés + tárolás + emlékeztető-frissítés. */
  private async doVerify(
    tenantId: string,
    vehicle: { id: string; plate: string | null; vin: string | null },
  ): Promise<VerificationView> {
    const data = await this.provider.verify({
      plate: vehicle.plate,
      vin: vehicle.vin,
      country: 'RO',
    });

    const toDate = (s: string | null) => (s ? new Date(s) : null);
    const itp = toDate(data.itpValidUntil);
    const rca = toDate(data.rcaValidUntil);
    const vig = toDate(data.vignetteValidUntil);

    await this.prisma.system.vehicleVerification.upsert({
      where: { vehicleId: vehicle.id },
      create: {
        tenantId,
        vehicleId: vehicle.id,
        source: data.source,
        status: data.status,
        itpValidUntil: itp,
        rcaValidUntil: rca,
        vignetteValidUntil: vig,
      },
      update: {
        source: data.source,
        status: data.status,
        itpValidUntil: itp,
        rcaValidUntil: rca,
        vignetteValidUntil: vig,
        checkedAt: new Date(),
      },
    });

    // Csak akkor frissítünk emlékeztetőt, ha valódi adatot kaptunk.
    if (data.status === 'ok') {
      for (const { field, type } of FIELD_TO_TYPE) {
        await this.applyReminder(tenantId, vehicle.id, type, data[field]);
      }
    }

    return {
      source: data.source,
      status: data.status,
      itpValidUntil: data.itpValidUntil,
      rcaValidUntil: data.rcaValidUntil,
      vignetteValidUntil: data.vignetteValidUntil,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Egy verification-eredetű compliance emlékeztető upsertje. A felhasználó által
   * kézzel felvett emlékeztetőket NEM érinti (csak a source="verification"-t).
   */
  private async applyReminder(
    tenantId: string,
    vehicleId: string,
    type: ReminderType,
    dateStr: string | null,
  ): Promise<void> {
    if (!dateStr) return;
    const dueDate = new Date(dateStr);

    const existing = await this.prisma.system.reminder.findFirst({
      where: { tenantId, vehicleId, type, source: 'verification' },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.system.reminder.updateMany({
        where: { id: existing.id, tenantId },
        data: {
          dueDate,
          active: true,
          notifiedStage: null,
          lastNotifiedAt: null,
        },
      });
    } else {
      await this.prisma.system.reminder.create({
        data: {
          tenantId,
          vehicleId,
          kind: ReminderKind.COMPLIANCE,
          type,
          source: 'verification',
          dueDate,
          intervalDays: 365,
        },
      });
    }
  }
}

/** RO rendszám felismerése (normalizálva: csak betű/szám, nagybetű). */
function isRoPlate(plate: string | null): boolean {
  if (!plate) return false;
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Bukarest: B + 2-3 számjegy + 3 betű; megye: 2 betű + 2 számjegy + 3 betű.
  return /^B\d{2,3}[A-Z]{3}$/.test(p) || /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(p);
}
