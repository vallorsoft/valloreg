import { Injectable } from '@nestjs/common';
import type { ExtractionResult } from '@valloreg/shared';
import {
  REMINDER_DUE_SOON_DAYS,
  REMINDER_DUE_SOON_KM,
  ReminderKind,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  pickSuggestion,
  rankCandidatesByRecency,
  REMINDER_TYPE_BY_PART,
  type PartHistoryEntry,
  type VehicleSuggestion,
} from './matching.util';

/** Egy feloldott jármű-egyezés a forrással és megbízhatósággal. */
export interface VehicleMatch {
  vehicleId: string | null;
  source: 'plate' | 'vin' | 'supplier_pattern' | 'history' | null;
  confidence: number;
}

/**
 * Felismerő ("matching") motor a worker számára.
 *
 * FONTOS: a worker NEM request-kontextusban fut (nincs tenant AsyncLocalStorage),
 * ezért itt a SYSTEM Prisma klienst használjuk, és a tenantId-t MINDEN
 * where/data-ban EXPLICITEN megadjuk.
 *
 * Két felelősség:
 *  1) `resolveSupplierId` – a számlán szereplő beszállító feloldása/létrehozása
 *     (normalizált név alapján). Ez kell a tanuló mappingekhez.
 *  2) `resolveVehicleForInvoice` – a számlához tartozó egyetlen jármű feloldása
 *     több stratégiával (prioritás: VIN → rendszám → beszállító-tanulás).
 */
@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Beszállító feloldása/létrehozása normalizált név alapján. Üres név → null. */
  async resolveSupplierId(
    tenantId: string,
    name: string,
  ): Promise<string | null> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return null;

    const normalizedName = normalizeName(trimmed);

    const existing = await this.prisma.system.supplier.findFirst({
      where: { tenantId, normalizedName },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.system.supplier.create({
      data: { tenantId, name: trimmed, normalizedName },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * A számlához tartozó legjobb jármű-egyezés feloldása.
   *
   * Prioritás:
   *  1) VIN egyezés a jelöltek és a meglévő járművek között (legerősebb).
   *  2) Rendszám egyezés (normalizálva: csak betűk/számok, nagybetű).
   *  3) Beszállító → jármű tanuló mapping, ha egyértelmű domináns jármű van.
   */
  async resolveVehicleForInvoice(
    tenantId: string,
    extraction: ExtractionResult,
    supplierId: string | null,
  ): Promise<VehicleMatch> {
    const vehicles = await this.prisma.system.vehicle.findMany({
      where: { tenantId },
      select: { id: true, plate: true, vin: true },
    });

    const byPlate = new Map<string, string>();
    const byVin = new Map<string, string>();
    for (const v of vehicles) {
      if (v.plate) byPlate.set(normalizePlate(v.plate), v.id);
      if (v.vin) byVin.set(normalizeVin(v.vin), v.id);
    }

    // 1–2) VIN / rendszám egyezés a kinyert jelöltekből.
    for (const candidate of extraction.invoice.vehicleCandidates) {
      if (candidate.vin) {
        const id = byVin.get(normalizeVin(candidate.vin));
        if (id) return { vehicleId: id, source: 'vin', confidence: 0.98 };
      }
      if (candidate.plate) {
        const id = byPlate.get(normalizePlate(candidate.plate));
        if (id) return { vehicleId: id, source: 'plate', confidence: 0.95 };
      }
    }

    // 3) Beszállító → jármű tanulás (domináns mapping).
    if (supplierId) {
      const mappings = await this.prisma.system.supplierVehicleMapping.findMany({
        where: { tenantId, supplierId },
        orderBy: { weight: 'desc' },
        select: { vehicleId: true, weight: true },
      });
      const [top, second] = mappings;
      if (top && !second) {
        return {
          vehicleId: top.vehicleId,
          source: 'supplier_pattern',
          confidence: 0.6,
        };
      }
      if (top && second && top.weight >= second.weight * 2) {
        return {
          vehicleId: top.vehicleId,
          source: 'history',
          confidence: 0.55,
        };
      }
    }

    return { vehicleId: null, source: null, confidence: 0 };
  }

  /**
   * Jármű-JAVASLAT egy alkatrész-tételhez az alapján, hogy ugyanazt az
   * alkatrészt (partKey – cikkszám, vagy kód nélkül típus+név) MELY járművekre
   * rakták már fel, és azokon mennyi ideje. A legrégebben cserélt jármű a
   * javaslat; a frissen cserélt kiesik. Esedékes karbantartási emlékeztető
   * (pl. olajcsere) erősíti a javaslatot.
   *
   * Csak a meglévő csere-előzményből dolgozik (az `excludeInvoiceId`-t kihagyva,
   * hogy az épp feldolgozott számla ne számítson bele). Ha nincs előzmény, vagy
   * minden jelölt frissen cserélt → `null` (nincs javaslat).
   */
  async suggestVehicleForItem(
    tenantId: string,
    partKey: string,
    partType: string | null,
    asOfDate: Date,
    asOfKm: number | null,
    excludeInvoiceId: string,
  ): Promise<VehicleSuggestion | null> {
    // 1) Előzmény: korábbi, járműhöz rendelt tételek ugyanezzel a partKey-jel.
    const prior = await this.prisma.system.invoiceItem.findMany({
      where: {
        tenantId,
        partKey,
        vehicleId: { not: null },
        invoiceId: { not: excludeInvoiceId },
      },
      select: {
        vehicleId: true,
        createdAt: true,
        invoice: { select: { date: true, odometerKm: true } },
      },
    });
    if (prior.length === 0) return null;

    // Járművenként a LEGUTÓBBI csere (számla dátuma, vagy createdAt fallback).
    const byVehicle = new Map<
      string,
      { last: Date; km: number | null; count: number }
    >();
    for (const p of prior) {
      if (!p.vehicleId) continue;
      const when = p.invoice?.date ?? p.createdAt;
      const km = p.invoice?.odometerKm ?? null;
      const cur = byVehicle.get(p.vehicleId);
      if (!cur) {
        byVehicle.set(p.vehicleId, { last: when, km, count: 1 });
      } else {
        cur.count += 1;
        if (when.getTime() > cur.last.getTime()) {
          cur.last = when;
          cur.km = km;
        }
      }
    }

    const history: PartHistoryEntry[] = [...byVehicle.entries()].map(
      ([vehicleId, v]) => ({
        vehicleId,
        lastReplacedAt: v.last,
        lastReplacedKm: v.km,
        timesReplaced: v.count,
      }),
    );

    const ranked = rankCandidatesByRecency(history, asOfDate, asOfKm);

    // 2) Másodlagos jel: esedékes karbantartási emlékeztető a jelölt járművön.
    const reminderType = partType
      ? REMINDER_TYPE_BY_PART[partType as keyof typeof REMINDER_TYPE_BY_PART]
      : undefined;
    if (reminderType && ranked.length > 0) {
      const vehicleIds = ranked.map((r) => r.vehicleId);
      const reminders = await this.prisma.system.reminder.findMany({
        where: {
          tenantId,
          vehicleId: { in: vehicleIds },
          kind: ReminderKind.MAINTENANCE,
          type: reminderType,
          active: true,
        },
        select: { vehicleId: true, dueDate: true, dueOdometerKm: true },
      });
      const dueSoonMs = REMINDER_DUE_SOON_DAYS * 86_400_000;
      const due = new Set<string>();
      for (const r of reminders) {
        const dueByDate =
          r.dueDate != null &&
          r.dueDate.getTime() <= asOfDate.getTime() + dueSoonMs;
        const dueByKm =
          r.dueOdometerKm != null &&
          asOfKm != null &&
          r.dueOdometerKm <= asOfKm + REMINDER_DUE_SOON_KM;
        if (dueByDate || dueByKm) due.add(r.vehicleId);
      }
      for (const c of ranked) {
        if (due.has(c.vehicleId)) c.dueReminder = true;
      }
    }

    return pickSuggestion(ranked);
  }
}

/** Beszállítónév normalizálása: kisbetű, többszörös szóköz összevonva. */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Rendszám normalizálása: csak betűk/számok, nagybetű (pl. "ABC-123" → "ABC123"). */
function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** VIN normalizálása: nagybetű, szóközök eltávolítva. */
function normalizeVin(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}
