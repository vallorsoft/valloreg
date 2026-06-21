import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Egy aggregált sor (járművenként / kategóriánként). */
export interface ReportRow {
  key: string;
  label: string;
  total: string;
  count: number;
}

/** Havi bontás (YYYY-MM). */
export interface MonthRow {
  month: string;
  total: string;
}

export interface ReportSummary {
  totals: {
    grossTotal: string;
    itemTotal: string;
    itemCount: number;
    invoiceCount: number;
    currency: string | null;
  };
  byVehicle: ReportRow[];
  byCategory: ReportRow[];
  byMonth: MonthRow[];
}

/** Egy lapos sor a CSV exporthoz. */
export interface ExportRow {
  date: string;
  supplier: string;
  invoiceNumber: string;
  vehicle: string;
  item: string;
  category: string;
  type: string;
  quantity: number;
  unitPrice: string;
  price: string;
  currency: string;
}

/**
 * Riportok: költségaggregáció járművenként, kategóriánként és havonta, valamint
 * lapos sorok az exporthoz. Minden lekérdezés tenant-scope-olt (scoped kliens).
 *
 * Megjegyzés: a riport MINDEN feldolgozott számlát figyelembe vesz (a státusztól
 * függetlenül); későbbi bővítés lehet a csak-jóváhagyott szűrés.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(from?: string, to?: string): Promise<ReportSummary> {
    const items = await this.loadItems(from, to);

    const byVehicle = new Map<
      string,
      { label: string; total: Prisma.Decimal; count: number }
    >();
    const byCategory = new Map<
      string,
      { total: Prisma.Decimal; count: number }
    >();
    const byMonth = new Map<string, Prisma.Decimal>();
    const invoiceIds = new Set<string>();
    let itemTotal = new Prisma.Decimal(0);
    let currency: string | null = null;

    for (const item of items) {
      itemTotal = itemTotal.add(item.price);
      if (item.invoice) invoiceIds.add(item.invoice.id);
      if (!currency && item.invoice?.currency) currency = item.invoice.currency;

      // Járművenként (a hozzá nem rendelt tételek "unassigned" kulcs alatt).
      const vKey = item.vehicleId ?? 'unassigned';
      const vLabel = item.vehicle ? vehicleLabel(item.vehicle) : '';
      const vEntry =
        byVehicle.get(vKey) ?? {
          label: vLabel,
          total: new Prisma.Decimal(0),
          count: 0,
        };
      vEntry.total = vEntry.total.add(item.price);
      vEntry.count += 1;
      if (vLabel) vEntry.label = vLabel;
      byVehicle.set(vKey, vEntry);

      // Kategóriánként.
      const cEntry =
        byCategory.get(item.category) ?? {
          total: new Prisma.Decimal(0),
          count: 0,
        };
      cEntry.total = cEntry.total.add(item.price);
      cEntry.count += 1;
      byCategory.set(item.category, cEntry);

      // Havonta (a számla dátuma alapján).
      const date = item.invoice?.date ?? null;
      if (date) {
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(
          month,
          (byMonth.get(month) ?? new Prisma.Decimal(0)).add(item.price),
        );
      }
    }

    const grossTotal = await this.sumInvoiceGross(from, to);

    return {
      totals: {
        grossTotal: grossTotal.toString(),
        itemTotal: itemTotal.toString(),
        itemCount: items.length,
        invoiceCount: invoiceIds.size,
        currency,
      },
      byVehicle: [...byVehicle.entries()]
        .map(([key, v]) => ({
          key,
          label: v.label,
          total: v.total.toString(),
          count: v.count,
        }))
        .sort((a, b) => Number(b.total) - Number(a.total)),
      byCategory: [...byCategory.entries()]
        .map(([key, c]) => ({
          key,
          label: key,
          total: c.total.toString(),
          count: c.count,
        }))
        .sort((a, b) => Number(b.total) - Number(a.total)),
      byMonth: [...byMonth.entries()]
        .map(([month, total]) => ({ month, total: total.toString() }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  async getExportRows(from?: string, to?: string): Promise<ExportRow[]> {
    const items = await this.loadItems(from, to);
    return items.map((item) => ({
      date: item.invoice?.date
        ? item.invoice.date.toISOString().slice(0, 10)
        : '',
      supplier: item.invoice?.supplier?.name ?? '',
      invoiceNumber: item.invoice?.invoiceNumber ?? '',
      vehicle: item.vehicle ? vehicleLabel(item.vehicle) : '',
      item: item.name,
      category: item.category,
      type: item.type,
      quantity: item.quantity,
      unitPrice: item.unitPrice?.toString() ?? '',
      price: item.price.toString(),
      currency: item.invoice?.currency ?? '',
    }));
  }

  private loadItems(from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);
    return this.prisma.scoped.invoiceItem.findMany({
      where: dateFilter ? { invoice: { date: dateFilter } } : {},
      include: {
        vehicle: { select: { id: true, plate: true, make: true, model: true } },
        invoice: {
          select: {
            id: true,
            date: true,
            currency: true,
            invoiceNumber: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async sumInvoiceGross(
    from?: string,
    to?: string,
  ): Promise<Prisma.Decimal> {
    const dateFilter = buildDateFilter(from, to);
    const agg = await this.prisma.scoped.invoice.aggregate({
      _sum: { grossTotal: true },
      where: dateFilter ? { date: dateFilter } : {},
    });
    return agg._sum.grossTotal ?? new Prisma.Decimal(0);
  }
}

/** Jármű címke: rendszám, vagy "gyártmány modell", vagy id-prefix. */
function vehicleLabel(v: {
  id: string;
  plate: string | null;
  make: string | null;
  model: string | null;
}): string {
  const name = [v.make, v.model].filter(Boolean).join(' ');
  const parts = [v.plate, name].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : v.id.slice(0, 8);
}

/** Dátumszűrő a from/to query alapján (a `to` napvégéig inkluzív). */
function buildDateFilter(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } | null {
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) filter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      filter.lte = d;
    }
  }
  return filter.gte || filter.lte ? filter : null;
}
