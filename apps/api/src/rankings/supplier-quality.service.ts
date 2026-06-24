import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { median, type SupplierQualityRow } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';

interface EventRow {
  vehicleId: string;
  component: string;
  odometerKm: number | null;
  totalCost: Prisma.Decimal | null;
  partsCost: Prisma.Decimal | null;
  laborCost: Prisma.Decimal | null;
  currency: string | null;
  invoiceId: string | null;
}

/**
 * Beszállító-minőség: ugyanaz a nagy alkatrész melyik beszállítónál kerül
 * kevesebbe és tart tovább. A költséget a beszállító eseményeinek medián
 * totalCost-ja adja; az élettartamot a csere-intervallumokból számoljuk, és a
 * KORÁBBI csere beszállítójának tudjuk be (az ő alkatrésze bírta ki azt a km-t).
 * Olvasásidejű, tenant-scope-olt.
 */
@Injectable()
export class SupplierQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuality(): Promise<SupplierQualityRow[]> {
    const events = (await this.prisma.scoped.majorComponentEvent.findMany({
      select: {
        vehicleId: true,
        component: true,
        odometerKm: true,
        totalCost: true,
        partsCost: true,
        laborCost: true,
        currency: true,
        invoiceId: true,
      },
    })) as EventRow[];
    if (events.length === 0) return [];

    // invoiceId → beszállító (név) feloldása.
    const invoiceIds = [
      ...new Set(events.map((e) => e.invoiceId).filter((v): v is string => !!v)),
    ];
    const invoices = invoiceIds.length
      ? await this.prisma.scoped.invoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, supplier: { select: { id: true, name: true } } },
        })
      : [];
    const supplierByInvoice = new Map<string, { id: string; name: string }>();
    for (const inv of invoices) {
      if (inv.supplier) supplierByInvoice.set(inv.id, inv.supplier);
    }

    // Költség-minták beszállító+fődarab szerint.
    const costs = new Map<string, number[]>();
    const currencies = new Map<string, string>();
    const names = new Map<string, string>();
    const keyOf = (supplierId: string, component: string) =>
      `${supplierId}::${component}`;

    for (const e of events) {
      const supplier = e.invoiceId
        ? supplierByInvoice.get(e.invoiceId)
        : undefined;
      if (!supplier) continue;
      const key = keyOf(supplier.id, e.component);
      names.set(key, supplier.name);
      const total =
        e.totalCost ??
        (e.partsCost != null || e.laborCost != null
          ? (e.partsCost ?? new Prisma.Decimal(0)).add(
              e.laborCost ?? new Prisma.Decimal(0),
            )
          : null);
      if (total != null) {
        const list = costs.get(key) ?? [];
        list.push(Number(total));
        costs.set(key, list);
      }
      if (!currencies.has(key) && e.currency) currencies.set(key, e.currency);
    }

    // Élettartam-intervallumok: járművenként+fődarabonként a cserék odométer
    // szerint rendezve; az intervallumot a KORÁBBI csere beszállítójának tudjuk be.
    const intervals = new Map<string, number[]>();
    const byVehicleComponent = new Map<string, EventRow[]>();
    for (const e of events) {
      if (e.odometerKm == null) continue;
      const k = `${e.vehicleId}::${e.component}`;
      const list = byVehicleComponent.get(k) ?? [];
      list.push(e);
      byVehicleComponent.set(k, list);
    }
    for (const [, list] of byVehicleComponent) {
      list.sort((a, b) => (a.odometerKm ?? 0) - (b.odometerKm ?? 0));
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1]!;
        const cur = list[i]!;
        const diff = (cur.odometerKm ?? 0) - (prev.odometerKm ?? 0);
        const supplier = prev.invoiceId
          ? supplierByInvoice.get(prev.invoiceId)
          : undefined;
        if (diff > 0 && supplier) {
          const key = keyOf(supplier.id, prev.component);
          const arr = intervals.get(key) ?? [];
          arr.push(diff);
          intervals.set(key, arr);
        }
      }
    }

    // Sorok összeállítása (minden kulcs, amelyhez van legalább egy esemény).
    const keys = new Set<string>([...costs.keys(), ...names.keys()]);
    const rows: SupplierQualityRow[] = [];
    for (const key of keys) {
      const [supplierId, component] = key.split('::') as [string, string];
      const costSamples = costs.get(key) ?? [];
      const intervalSamples = intervals.get(key) ?? [];
      const medCost = median(costSamples);
      const medInterval = median(intervalSamples);
      rows.push({
        supplierId,
        supplierName: names.get(key) ?? supplierId,
        component,
        eventCount: costSamples.length,
        medianCost: medCost != null ? new Prisma.Decimal(medCost).toString() : null,
        currency: currencies.get(key) ?? null,
        medianIntervalKm: medInterval != null ? Math.round(medInterval) : null,
        intervalSamples: intervalSamples.length,
      });
    }

    rows.sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName) ||
        a.component.localeCompare(b.component),
    );
    return rows;
  }
}
