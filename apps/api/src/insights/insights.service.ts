import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AnomalySeverity,
  AnomalyType,
  PRICE_SPIKE_RATIO,
  UNUSUAL_AMOUNT_RATIO,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Egy észlelt anomália (olvasásidőben számítva, nem perzisztált). */
export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  documentId: string | null;
  invoiceId: string | null;
  date: string | null;
  supplier: string | null;
  vehicleLabel: string | null;
  itemName: string | null;
  currency: string | null;
  /** A vizsgált összeg (tétel egységár vagy számla bruttó). */
  amount: string | null;
  /** A viszonyítási alap (kategória- vagy cég-medián). */
  baseline: string | null;
  /** Hány százalékkal magasabb az alapnál. */
  deltaPct: number | null;
  /** Duplikátum-csoport mérete. */
  count: number | null;
}

export interface AnomalySummary {
  total: number;
  byType: Record<AnomalyType, number>;
  bySeverity: Record<AnomalySeverity, number>;
}

const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Költség-anomália detektálás a meglévő szerviz/számla adatból. Minden
 * lekérdezés tenant-scope-olt (scoped kliens). Az eredmény olvasásidőben
 * számított – nincs külön tábla, így nincs migráció és nincs elavuló állapot.
 */
@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Minden anomália, súlyosság szerint rendezve. */
  async getAnomalies(): Promise<Anomaly[]> {
    const [items, invoices] = await Promise.all([
      this.prisma.scoped.invoiceItem.findMany({
        where: { price: { gt: 0 } },
        include: {
          vehicle: { select: { plate: true, make: true, model: true } },
          invoice: {
            select: {
              id: true,
              documentId: true,
              date: true,
              currency: true,
              supplier: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.scoped.invoice.findMany({
        select: {
          id: true,
          documentId: true,
          date: true,
          currency: true,
          invoiceNumber: true,
          supplierId: true,
          grossTotal: true,
          supplier: { select: { name: true } },
        },
      }),
    ]);

    const anomalies: Anomaly[] = [
      ...this.detectPriceSpikes(items),
      ...this.detectDuplicateInvoices(invoices),
      ...this.detectUnusualAmounts(invoices),
    ];

    return anomalies.sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        (b.deltaPct ?? 0) - (a.deltaPct ?? 0),
    );
  }

  async getSummary(): Promise<AnomalySummary> {
    const anomalies = await this.getAnomalies();
    const summary: AnomalySummary = {
      total: anomalies.length,
      byType: { price_spike: 0, duplicate_invoice: 0, unusual_amount: 0 },
      bySeverity: { high: 0, medium: 0, low: 0 },
    };
    for (const a of anomalies) {
      summary.byType[a.type]++;
      summary.bySeverity[a.severity]++;
    }
    return summary;
  }

  // ── Detektorok ─────────────────────────────────────────────────────────────

  /** Túlárazott tétel: egységár > a kategória (partType/név) mediánja × küszöb. */
  private detectPriceSpikes(
    items: PriceItem[],
  ): Anomaly[] {
    // Kulcs szerinti csoportosítás (alkatrésztípus, vagy normalizált név).
    const groups = new Map<string, { item: PriceItem; perUnit: number }[]>();
    for (const item of items) {
      const perUnit = unitPriceOf(item);
      if (perUnit == null || perUnit <= 0) continue;
      const key = item.partType || normalizeName(item.name);
      if (!key) continue;
      const arr = groups.get(key) ?? [];
      arr.push({ item, perUnit });
      groups.set(key, arr);
    }

    const result: Anomaly[] = [];
    for (const entries of groups.values()) {
      // Legalább 3 adatpont kell egy értelmes alaphoz.
      if (entries.length < 3) continue;
      const baseline = median(entries.map((e) => e.perUnit));
      if (baseline <= 0) continue;

      for (const { item, perUnit } of entries) {
        if (perUnit < baseline * PRICE_SPIKE_RATIO) continue;
        const deltaPct = Math.round((perUnit / baseline - 1) * 100);
        result.push({
          id: `price:${item.id}`,
          type: AnomalyType.PRICE_SPIKE,
          severity:
            deltaPct >= 120
              ? AnomalySeverity.HIGH
              : deltaPct >= 80
                ? AnomalySeverity.MEDIUM
                : AnomalySeverity.LOW,
          documentId: item.invoice?.documentId ?? null,
          invoiceId: item.invoice?.id ?? null,
          date: item.invoice?.date?.toISOString() ?? null,
          supplier: item.invoice?.supplier?.name ?? null,
          vehicleLabel: item.vehicle ? vehicleLabel(item.vehicle) : null,
          itemName: item.name,
          currency: item.invoice?.currency ?? null,
          amount: perUnit.toFixed(2),
          baseline: baseline.toFixed(2),
          deltaPct,
          count: null,
        });
      }
    }
    return result;
  }

  /** Duplikált számla: azonos (beszállító + számlaszám) többször. */
  private detectDuplicateInvoices(invoices: InvoiceRow[]): Anomaly[] {
    const groups = new Map<string, InvoiceRow[]>();
    for (const inv of invoices) {
      const num = (inv.invoiceNumber ?? '').trim();
      if (!num) continue;
      const key = `${inv.supplierId ?? ''}::${num.toLowerCase()}`;
      const arr = groups.get(key) ?? [];
      arr.push(inv);
      groups.set(key, arr);
    }

    const result: Anomaly[] = [];
    for (const group of groups.values()) {
      const first = group[0];
      if (group.length < 2 || !first) continue;
      result.push({
        id: `dup:${first.id}`,
        type: AnomalyType.DUPLICATE_INVOICE,
        severity: AnomalySeverity.HIGH,
        documentId: first.documentId,
        invoiceId: first.id,
        date: first.date?.toISOString() ?? null,
        supplier: first.supplier?.name ?? null,
        vehicleLabel: null,
        itemName: first.invoiceNumber,
        currency: first.currency,
        amount: first.grossTotal?.toString() ?? null,
        baseline: null,
        deltaPct: null,
        count: group.length,
      });
    }
    return result;
  }

  /** Szokatlan összeg: számla bruttó > a cég-medián × küszöb. */
  private detectUnusualAmounts(invoices: InvoiceRow[]): Anomaly[] {
    const grosses = invoices
      .map((i) => (i.grossTotal ? i.grossTotal.toNumber() : null))
      .filter((n): n is number => n != null && n > 0);
    // Kis mintánál az átlag félrevezető – legalább 5 számla kell.
    if (grosses.length < 5) return [];

    const baseline = median(grosses);
    if (baseline <= 0) return [];

    const result: Anomaly[] = [];
    for (const inv of invoices) {
      const gross = inv.grossTotal?.toNumber();
      if (gross == null || gross <= 0) continue;
      if (gross < baseline * UNUSUAL_AMOUNT_RATIO) continue;
      const deltaPct = Math.round((gross / baseline - 1) * 100);
      result.push({
        id: `amount:${inv.id}`,
        type: AnomalyType.UNUSUAL_AMOUNT,
        severity:
          gross >= baseline * 5 ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
        documentId: inv.documentId,
        invoiceId: inv.id,
        date: inv.date?.toISOString() ?? null,
        supplier: inv.supplier?.name ?? null,
        vehicleLabel: null,
        itemName: null,
        currency: inv.currency,
        amount: gross.toFixed(2),
        baseline: baseline.toFixed(2),
        deltaPct,
        count: null,
      });
    }
    return result;
  }
}

// ── Típusok a Prisma payloadokhoz ─────────────────────────────────────────────

type PriceItem = Prisma.InvoiceItemGetPayload<{
  include: {
    vehicle: { select: { plate: true; make: true; model: true } };
    invoice: {
      select: {
        id: true;
        documentId: true;
        date: true;
        currency: true;
        supplier: { select: { name: true } };
      };
    };
  };
}>;

interface InvoiceRow {
  id: string;
  documentId: string;
  date: Date | null;
  currency: string | null;
  invoiceNumber: string | null;
  supplierId: string | null;
  grossTotal: Prisma.Decimal | null;
  supplier: { name: string } | null;
}

// ── Segédfüggvények ───────────────────────────────────────────────────────────

function unitPriceOf(item: PriceItem): number | null {
  if (item.unitPrice != null) return item.unitPrice.toNumber();
  const price = item.price.toNumber();
  const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
  return price / qty;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function vehicleLabel(v: {
  plate: string | null;
  make: string | null;
  model: string | null;
}): string {
  const name = [v.make, v.model].filter(Boolean).join(' ');
  const parts = [v.plate, name].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
