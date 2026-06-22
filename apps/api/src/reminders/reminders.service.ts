import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  REMINDER_DUE_SOON_DAYS,
  REMINDER_DUE_SOON_KM,
  REMINDER_KIND_BY_TYPE,
  REMINDER_OVERDUE_RENOTIFY_DAYS,
  ReminderKind,
  ReminderStatus,
  ReminderType,
  type ReminderType as ReminderTypeT,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../storage/mailer.service';
import type { CreateReminderDto } from './dto/create-reminder.dto';
import type { UpdateReminderDto } from './dto/update-reminder.dto';
import type { CompleteReminderDto } from './dto/complete-reminder.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Egy emlékeztető a számított sürgősségi állapottal és a hátralévő idő/km-mel. */
export interface ReminderView {
  id: string;
  vehicleId: string;
  vehicle: {
    id: string;
    plate: string | null;
    make: string | null;
    model: string | null;
    odometerKm: number | null;
  } | null;
  kind: string;
  type: string;
  title: string | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  intervalDays: number | null;
  intervalKm: number | null;
  lastDoneAt: string | null;
  lastDoneKm: number | null;
  notes: string | null;
  active: boolean;
  status: ReminderStatus;
  daysRemaining: number | null;
  kmRemaining: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Történetből származó (nem perzisztált) emlékeztető-javaslat. */
export interface ReminderSuggestion {
  type: ReminderTypeT;
  kind: ReminderKind;
  intervalKm: number | null;
  intervalDays: number | null;
  lastDoneAt: string | null;
  lastDoneKm: number | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  reason: string;
}

/** Alapértelmezett karbantartási intervallumok a történet-alapú javaslatokhoz. */
const DEFAULT_MAINTENANCE_INTERVALS: Record<
  string,
  { km: number | null; days: number | null }
> = {
  [ReminderType.OIL_CHANGE]: { km: 15_000, days: 365 },
  [ReminderType.TIMING_BELT]: { km: 120_000, days: 1825 },
  [ReminderType.BRAKE_SERVICE]: { km: 40_000, days: 730 },
  [ReminderType.TIRE_CHANGE]: { km: null, days: 182 },
  [ReminderType.GENERAL_SERVICE]: { km: 30_000, days: 365 },
};

/** partType / név → karbantartási típus felismerés a szerviztörténetből. */
function detectMaintenanceType(
  partType: string | null,
  name: string,
): ReminderTypeT | null {
  const n = (name ?? '').toLowerCase();
  if (partType === 'filters' || /olaj|oil|öl/.test(n))
    return ReminderType.OIL_CHANGE;
  if (/vezérlés|timing|szíj|belt/.test(n)) return ReminderType.TIMING_BELT;
  if (partType === 'brakes' || /fék|brake/.test(n))
    return ReminderType.BRAKE_SERVICE;
  if (partType === 'tires' || /gumi|tire|tyre|abroncs/.test(n))
    return ReminderType.TIRE_CHANGE;
  return null;
}

/**
 * Emlékeztetők (proaktív karbantartás + lejárat-figyelés).
 *
 * A CRUD a scoped Prisma klienssel megy (tenant-izoláció). A `scanAndNotify`
 * a háttér-ütemezőből hívódik (NINCS request-kontextus), ezért ott a SYSTEM
 * kliens megy explicit tenantId-vel.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

  // ── Számított állapot ──────────────────────────────────────────────────────

  /** Egy emlékeztető sürgősségi állapota a határidő / km-állás alapján. */
  static evaluate(
    r: {
      dueDate: Date | null;
      dueOdometerKm: number | null;
    },
    odometerKm: number | null,
    now: Date = new Date(),
  ): {
    status: ReminderStatus;
    daysRemaining: number | null;
    kmRemaining: number | null;
  } {
    let daysRemaining: number | null = null;
    let kmRemaining: number | null = null;

    if (r.dueDate) {
      daysRemaining = Math.ceil((r.dueDate.getTime() - now.getTime()) / DAY_MS);
    }
    if (r.dueOdometerKm != null && odometerKm != null) {
      kmRemaining = r.dueOdometerKm - odometerKm;
    }

    const overdue =
      (daysRemaining != null && daysRemaining < 0) ||
      (kmRemaining != null && kmRemaining < 0);
    const dueSoon =
      (daysRemaining != null && daysRemaining <= REMINDER_DUE_SOON_DAYS) ||
      (kmRemaining != null && kmRemaining <= REMINDER_DUE_SOON_KM);

    const status = overdue
      ? ReminderStatus.OVERDUE
      : dueSoon
        ? ReminderStatus.DUE_SOON
        : ReminderStatus.OK;

    return { status, daysRemaining, kmRemaining };
  }

  /** Sürgősségi rendezési kulcs (kisebb = sürgősebb). */
  private static sortKey(v: ReminderView): number {
    const rank =
      v.status === ReminderStatus.OVERDUE
        ? 0
        : v.status === ReminderStatus.DUE_SOON
          ? 1
          : 2;
    const days = v.daysRemaining ?? 99_999;
    return rank * 1_000_000 + days;
  }

  private toView(
    r: Prisma.ReminderGetPayload<{
      include: {
        vehicle: {
          select: {
            id: true;
            plate: true;
            make: true;
            model: true;
            odometerKm: true;
          };
        };
      };
    }>,
  ): ReminderView {
    const odo = r.vehicle?.odometerKm ?? null;
    const { status, daysRemaining, kmRemaining } = RemindersService.evaluate(
      { dueDate: r.dueDate, dueOdometerKm: r.dueOdometerKm },
      odo,
    );
    return {
      id: r.id,
      vehicleId: r.vehicleId,
      vehicle: r.vehicle
        ? {
            id: r.vehicle.id,
            plate: r.vehicle.plate,
            make: r.vehicle.make,
            model: r.vehicle.model,
            odometerKm: r.vehicle.odometerKm,
          }
        : null,
      kind: r.kind,
      type: r.type,
      title: r.title,
      dueDate: r.dueDate?.toISOString() ?? null,
      dueOdometerKm: r.dueOdometerKm,
      intervalDays: r.intervalDays,
      intervalKm: r.intervalKm,
      lastDoneAt: r.lastDoneAt?.toISOString() ?? null,
      lastDoneKm: r.lastDoneKm,
      notes: r.notes,
      active: r.active,
      status,
      daysRemaining,
      kmRemaining,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private static readonly VEHICLE_SELECT = {
    id: true,
    plate: true,
    make: true,
    model: true,
    odometerKm: true,
  } as const;

  // ── CRUD (scoped) ──────────────────────────────────────────────────────────

  /** Lista – opcionálisan egy járműre szűrve, sürgősség szerint rendezve. */
  async list(vehicleId?: string): Promise<ReminderView[]> {
    const rows = await this.prisma.scoped.reminder.findMany({
      where: vehicleId ? { vehicleId } : undefined,
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });
    return rows
      .map((r) => this.toView(r))
      .sort((a, b) => RemindersService.sortKey(a) - RemindersService.sortKey(b));
  }

  /** Csak az aktív, esedékes (due_soon/overdue) emlékeztetők – dashboard widget. */
  async upcoming(limit = 8): Promise<ReminderView[]> {
    const all = await this.list();
    return all
      .filter(
        (r) =>
          r.active &&
          (r.status === ReminderStatus.OVERDUE ||
            r.status === ReminderStatus.DUE_SOON),
      )
      .slice(0, limit);
  }

  async getById(id: string): Promise<ReminderView> {
    const r = await this.prisma.scoped.reminder.findFirst({
      where: { id },
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });
    if (!r) throw AppException.notFound('Az emlékeztető nem található.');
    return this.toView(r);
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateReminderDto,
  ): Promise<ReminderView> {
    if (
      !dto.dueDate &&
      dto.dueOdometerKm == null &&
      !dto.intervalDays &&
      dto.intervalKm == null
    ) {
      throw AppException.validation(
        'Adjon meg legalább egy esedékességet (dátum vagy km) vagy intervallumot.',
      );
    }

    // A jármű létezésének tenant-scope-olt ellenőrzése (idegen jármű kizárva).
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id: dto.vehicleId },
      select: { id: true },
    });
    if (!vehicle) throw AppException.notFound('A jármű nem található.');

    const created = await this.prisma.scoped.reminder.create({
      // tenantId-t a scoped kliens is injektálja; explicit átadjuk a típus-
      // biztonságért (az érték azonos, így nincs ütközés).
      data: {
        tenantId,
        vehicleId: dto.vehicleId,
        kind: dto.kind,
        type: dto.type,
        title: dto.title ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        dueOdometerKm: dto.dueOdometerKm ?? null,
        intervalDays: dto.intervalDays ?? null,
        intervalKm: dto.intervalKm ?? null,
        notes: dto.notes ?? null,
        active: dto.active ?? true,
      },
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reminder.created',
      resourceType: 'Reminder',
      resourceId: created.id,
      metadata: { kind: created.kind, type: created.type },
    });

    return this.toView(created);
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateReminderDto,
  ): Promise<ReminderView> {
    await this.getById(id); // tenant-scope-olt létezés-ellenőrzés

    const data: Prisma.ReminderUpdateInput = {};
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = dto.title || null;
    if (dto.dueDate !== undefined)
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.dueOdometerKm !== undefined)
      data.dueOdometerKm = dto.dueOdometerKm ?? null;
    if (dto.intervalDays !== undefined)
      data.intervalDays = dto.intervalDays ?? null;
    if (dto.intervalKm !== undefined) data.intervalKm = dto.intervalKm ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;
    if (dto.active !== undefined) data.active = dto.active;

    // Bármilyen esedékesség-változás → értesítés-állapot nullázása (újra értesíthet).
    if (
      dto.dueDate !== undefined ||
      dto.dueOdometerKm !== undefined ||
      dto.active !== undefined
    ) {
      data.notifiedStage = null;
      data.lastNotifiedAt = null;
    }

    const updated = await this.prisma.scoped.reminder.update({
      where: { id },
      data,
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reminder.updated',
      resourceType: 'Reminder',
      resourceId: id,
    });

    return this.toView(updated);
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    await this.getById(id);
    await this.prisma.scoped.reminder.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      userId,
      action: 'reminder.deleted',
      resourceType: 'Reminder',
      resourceId: id,
    });
  }

  /**
   * "Elvégezve" jelölés: rögzíti az elvégzést, és ha van intervallum (idő/km),
   * előregördíti a következő esedékességet. Intervallum nélkül az emlékeztető
   * inaktívvá válik (egyszeri teendő).
   */
  async complete(
    tenantId: string,
    userId: string,
    id: string,
    dto: CompleteReminderDto,
  ): Promise<ReminderView> {
    const current = await this.prisma.scoped.reminder.findFirst({
      where: { id },
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });
    if (!current) throw AppException.notFound('Az emlékeztető nem található.');

    const doneAt = dto.doneAt ? new Date(dto.doneAt) : new Date();
    const doneKm = dto.doneKm ?? current.vehicle?.odometerKm ?? null;

    const hasInterval =
      current.intervalDays != null || current.intervalKm != null;

    const data: Prisma.ReminderUpdateInput = {
      lastDoneAt: doneAt,
      lastDoneKm: doneKm,
      notifiedStage: null,
      lastNotifiedAt: null,
    };

    if (hasInterval) {
      if (current.intervalDays != null) {
        data.dueDate = new Date(
          doneAt.getTime() + current.intervalDays * DAY_MS,
        );
      }
      if (current.intervalKm != null && doneKm != null) {
        data.dueOdometerKm = doneKm + current.intervalKm;
      }
      data.active = true;
    } else {
      // Egyszeri teendő: elvégzés után inaktív.
      data.active = false;
    }

    const updated = await this.prisma.scoped.reminder.update({
      where: { id },
      data,
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'reminder.completed',
      resourceType: 'Reminder',
      resourceId: id,
      metadata: { doneKm, rolledForward: hasInterval },
    });

    return this.toView(updated);
  }

  // ── Történet-alapú javaslatok ───────────────────────────────────────────────

  /**
   * A jármű szerviztörténetéből karbantartási emlékeztető-javaslatokat ad
   * (nem perzisztál). A legutóbbi releváns szervizből + alap-intervallumból
   * becsli a következő esedékességet. Csak olyan típusokat ajánl, amelyre még
   * NINCS aktív emlékeztető.
   */
  async suggestFromHistory(vehicleId: string): Promise<ReminderSuggestion[]> {
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id: vehicleId },
      select: { id: true, odometerKm: true },
    });
    if (!vehicle) throw AppException.notFound('A jármű nem található.');

    const existing = await this.prisma.scoped.reminder.findMany({
      where: { vehicleId, active: true },
      select: { type: true },
    });
    const existingTypes = new Set(existing.map((e) => e.type));

    const items = await this.prisma.scoped.invoiceItem.findMany({
      where: { vehicleId },
      include: { invoice: { select: { date: true, odometerKm: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Típusonként a legutóbbi (legfrissebb dátumú) szerviz dátuma + km-állása.
    const latest = new Map<
      ReminderTypeT,
      { date: Date | null; km: number | null }
    >();
    for (const item of items) {
      const t = detectMaintenanceType(item.partType, item.name);
      if (!t) continue;
      const date = item.invoice?.date ?? null;
      const km = item.invoice?.odometerKm ?? null;
      const prev = latest.get(t);
      if (!prev || (date && (!prev.date || date > prev.date))) {
        latest.set(t, { date, km });
      }
    }

    const suggestions: ReminderSuggestion[] = [];
    for (const [type, info] of latest) {
      if (existingTypes.has(type)) continue;
      const interval = DEFAULT_MAINTENANCE_INTERVALS[type];
      if (!interval) continue;

      const dueDate =
        info.date && interval.days
          ? new Date(info.date.getTime() + interval.days * DAY_MS)
          : null;
      const dueOdometerKm =
        info.km != null && interval.km != null ? info.km + interval.km : null;

      suggestions.push({
        type,
        kind: ReminderKind.MAINTENANCE,
        intervalKm: interval.km,
        intervalDays: interval.days,
        lastDoneAt: info.date?.toISOString() ?? null,
        lastDoneKm: info.km,
        dueDate: dueDate?.toISOString() ?? null,
        dueOdometerKm,
        reason: 'Korábbi szervizből becsült esedékesség.',
      });
    }

    return suggestions;
  }

  // ── Háttér-ütemező: esedékesség-szkennelés + értesítés ───────────────────────

  /**
   * Minden tenant aktív emlékeztetőjét végignézi, és a most esedékessé
   * (due_soon) vagy lejárttá (overdue) vált emlékeztetőkről értesít (push a
   * cég eszközeire + email a tulajdonosnak). Throttle: ugyanarról az állapotról
   * nem küld újra (a lejárt emlékeztetők hetente ismétlődnek).
   *
   * NINCS request-kontextus → SYSTEM kliens, explicit tenantId.
   */
  async scanAndNotify(now: Date = new Date()): Promise<{
    scanned: number;
    notified: number;
  }> {
    const reminders = await this.prisma.system.reminder.findMany({
      where: { active: true },
      include: { vehicle: { select: RemindersService.VEHICLE_SELECT } },
    });

    let notified = 0;
    for (const r of reminders) {
      const odo = r.vehicle?.odometerKm ?? null;
      const { status } = RemindersService.evaluate(
        { dueDate: r.dueDate, dueOdometerKm: r.dueOdometerKm },
        odo,
        now,
      );
      if (status === ReminderStatus.OK) continue;

      const enteredNewStage = r.notifiedStage !== status;
      const overdueRenotify =
        status === ReminderStatus.OVERDUE &&
        r.lastNotifiedAt != null &&
        now.getTime() - r.lastNotifiedAt.getTime() >=
          REMINDER_OVERDUE_RENOTIFY_DAYS * DAY_MS;

      if (!enteredNewStage && !overdueRenotify) continue;

      try {
        await this.notifyOne(r.tenantId, r, status);
        await this.prisma.system.reminder.updateMany({
          where: { id: r.id, tenantId: r.tenantId },
          data: { lastNotifiedAt: now, notifiedStage: status },
        });
        notified++;
      } catch (err) {
        this.logger.warn(
          `Emlékeztető értesítés sikertelen (${r.id}): ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Emlékeztető-szkennelés kész: ${reminders.length} aktív, ${notified} értesítés.`,
    );
    return { scanned: reminders.length, notified };
  }

  /** Egy esedékes emlékeztető értesítése (push a céghez + email a tulajdonosnak). */
  private async notifyOne(
    tenantId: string,
    r: Prisma.ReminderGetPayload<{
      include: {
        vehicle: {
          select: {
            id: true;
            plate: true;
            make: true;
            model: true;
            odometerKm: true;
          };
        };
      };
    }>,
    status: ReminderStatus,
  ): Promise<void> {
    const vehicleLabel =
      r.vehicle?.plate ||
      [r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(' ') ||
      'jármű';
    const what = r.title || labelForType(r.type);
    const overdue = status === ReminderStatus.OVERDUE;

    const title = overdue
      ? `Lejárt: ${what}`
      : `Hamarosan esedékes: ${what}`;
    const body = `${vehicleLabel} – ${what} ${
      overdue ? 'határideje lejárt' : 'hamarosan esedékes'
    }${r.dueDate ? ` (${r.dueDate.toISOString().slice(0, 10)})` : ''}.`;

    // Push a cég összes feliratkozott eszközére (a service belül no-op, ha nincs VAPID).
    await this.notifications.sendToTenant(tenantId, {
      title,
      body,
      url: `/reminders`,
    });

    // Email a tulajdonosnak (ha van).
    const owner = await this.prisma.system.membership.findFirst({
      where: { tenantId, role: 'OWNER' },
      include: { user: { select: { email: true, name: true } } },
    });
    if (owner?.user?.email) {
      await this.mailer.send({
        to: owner.user.email,
        subject: `[Valloreg] ${title}`,
        text: `${body}\n\nNyissa meg az emlékeztetőket a Valloreg felületén.`,
      });
    }
  }
}

/** Típus → ember-olvasható (magyar) címke az értesítésekhez. */
function labelForType(type: string): string {
  const map: Record<string, string> = {
    [ReminderType.OIL_CHANGE]: 'Olajcsere',
    [ReminderType.TIMING_BELT]: 'Vezérműszíj csere',
    [ReminderType.BRAKE_SERVICE]: 'Fékszerviz',
    [ReminderType.TIRE_CHANGE]: 'Gumicsere',
    [ReminderType.GENERAL_SERVICE]: 'Általános szerviz',
    [ReminderType.INSPECTION]: 'Műszaki vizsga',
    [ReminderType.INSURANCE]: 'Biztosítás',
    [ReminderType.TACHOGRAPH]: 'Tachográf kalibrálás',
    [ReminderType.VIGNETTE]: 'Autópálya-matrica',
    [ReminderType.OTHER]: 'Emlékeztető',
  };
  return map[type] ?? 'Emlékeztető';
}

// A REMINDER_KIND_BY_TYPE-ot a frontend/validáció használja; itt csak re-export
// a típuskonzisztencia kedvéért (lint: ne tűnjön nem használtnak).
void REMINDER_KIND_BY_TYPE;
