import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BENCHMARK_MIN_TENANTS,
  BENCHMARK_MIN_VEHICLES,
  BenchmarkComparison,
  kmBucketOf,
  positionOf,
  VehicleRecall,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RECALL_PROVIDER, type RecallProvider } from './recall.provider';

/** A benchmark-cellába gyűjtött nyers adat (aggregálás közben). */
interface CellAccumulator {
  makeModel: string;
  itemCategory: string;
  kmBucket: number;
  currency: string;
  values: number[];
  tenants: Set<string>;
  vehicles: Set<string>;
}

/** A kérő cég egy szegmensének saját értékei (összevetéshez). */
interface OwnSegment {
  makeModel: string;
  itemCategory: string;
  kmBucket: number;
  currency: string;
  values: number[];
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RECALL_PROVIDER) private readonly recall: RecallProvider,
  ) {}

  // ── Aggregálás (cross-tenant, háttér-job) ────────────────────────────────────

  /**
   * Újraszámolja a teljes flotta-benchmarkot. CROSS-TENANT olvasás a system
   * klienssel (csak az opt-in cégek tételei), majd k-anonimitási kapu: egy cella
   * csak akkor publikus, ha legalább BENCHMARK_MIN_TENANTS cég ÉS
   * BENCHMARK_MIN_VEHICLES jármű adta. A publikus cellák atomikusan cserélődnek.
   */
  async recompute(): Promise<{ cells: number; skipped: number }> {
    const optedIn = await this.prisma.system.tenant.findMany({
      where: { benchmarkOptIn: true },
      select: { id: true },
    });
    const optedInIds = optedIn.map((t) => t.id);
    if (optedInIds.length === 0) {
      await this.prisma.system.fleetBenchmark.deleteMany({});
      this.logger.log('Nincs opt-in cég – a benchmark üres.');
      return { cells: 0, skipped: 0 };
    }

    const items = await this.prisma.system.invoiceItem.findMany({
      where: {
        price: { gt: 0 },
        vehicleId: { not: null },
        tenantId: { in: optedInIds },
      },
      select: {
        tenantId: true,
        vehicleId: true,
        unitPrice: true,
        price: true,
        quantity: true,
        partType: true,
        name: true,
        vehicle: { select: { make: true, model: true, odometerKm: true } },
        invoice: { select: { currency: true } },
      },
    });

    const cells = new Map<string, CellAccumulator>();
    for (const it of items) {
      const perUnit = unitPriceOf(it);
      if (perUnit == null || perUnit <= 0) continue;
      const makeModel = normalize(
        [it.vehicle?.make, it.vehicle?.model].filter(Boolean).join(' '),
      );
      if (!makeModel) continue;
      const itemCategory = it.partType || normalize(it.name);
      if (!itemCategory) continue;
      const currency = it.invoice?.currency?.trim();
      if (!currency) continue;
      const bucket = kmBucketOf(it.vehicle?.odometerKm);

      const key = `${makeModel}||${itemCategory}||${bucket}||${currency}`;
      const cell: CellAccumulator = cells.get(key) ?? {
        makeModel,
        itemCategory,
        kmBucket: bucket,
        currency,
        values: [],
        tenants: new Set<string>(),
        vehicles: new Set<string>(),
      };
      cell.values.push(perUnit);
      cell.tenants.add(it.tenantId);
      if (it.vehicleId) cell.vehicles.add(it.vehicleId);
      cells.set(key, cell);
    }

    const rows: Prisma.FleetBenchmarkCreateManyInput[] = [];
    let skipped = 0;
    for (const cell of cells.values()) {
      // k-anonimitás kapu: enélkül egyetlen cella sem publikálható.
      if (
        cell.tenants.size < BENCHMARK_MIN_TENANTS ||
        cell.vehicles.size < BENCHMARK_MIN_VEHICLES
      ) {
        skipped++;
        continue;
      }
      rows.push({
        makeModel: cell.makeModel,
        itemCategory: cell.itemCategory,
        kmBucket: cell.kmBucket,
        currency: cell.currency,
        medianUnitPrice: new Prisma.Decimal(percentile(cell.values, 50)),
        p25: new Prisma.Decimal(percentile(cell.values, 25)),
        p75: new Prisma.Decimal(percentile(cell.values, 75)),
        sampleTenants: cell.tenants.size,
        sampleVehicles: cell.vehicles.size,
      });
    }

    // Atomikus csere: a régi cellák törlése + az új publikus cellák beszúrása.
    await this.prisma.system.$transaction([
      this.prisma.system.fleetBenchmark.deleteMany({}),
      this.prisma.system.fleetBenchmark.createMany({ data: rows }),
    ]);

    this.logger.log(
      `Benchmark frissítve: ${rows.length} publikus cella (${skipped} a küszöb alatt).`,
    );
    return { cells: rows.length, skipped };
  }

  // ── Olvasásidejű összevetés (a kérő tenant scope-jában) ──────────────────────

  /**
   * A kérő cég saját szegmens-mediánjait összeveti a piaci benchmarkkal. Csak
   * azokat a szegmenseket adja vissza, amelyekhez VAN publikus benchmark-cella.
   * Tenant-scope a scoped kliensből; a benchmark globális (system).
   */
  async getComparison(): Promise<BenchmarkComparison[]> {
    const items = await this.prisma.scoped.invoiceItem.findMany({
      where: { price: { gt: 0 }, vehicleId: { not: null } },
      select: {
        unitPrice: true,
        price: true,
        quantity: true,
        partType: true,
        name: true,
        vehicle: { select: { make: true, model: true, odometerKm: true } },
        invoice: { select: { currency: true } },
      },
    });

    // A cég saját értékei szegmensenként.
    const own = new Map<string, OwnSegment>();
    for (const it of items) {
      const perUnit = unitPriceOf(it);
      if (perUnit == null || perUnit <= 0) continue;
      const makeModel = normalize(
        [it.vehicle?.make, it.vehicle?.model].filter(Boolean).join(' '),
      );
      if (!makeModel) continue;
      const itemCategory = it.partType || normalize(it.name);
      if (!itemCategory) continue;
      const currency = it.invoice?.currency?.trim();
      if (!currency) continue;
      const bucket = kmBucketOf(it.vehicle?.odometerKm);
      const key = `${makeModel}||${itemCategory}||${bucket}||${currency}`;
      const g: OwnSegment = own.get(key) ?? {
        makeModel,
        itemCategory,
        kmBucket: bucket,
        currency,
        values: [],
      };
      g.values.push(perUnit);
      own.set(key, g);
    }
    if (own.size === 0) return [];

    const benchmarks = await this.prisma.system.fleetBenchmark.findMany();
    const byKey = new Map(
      benchmarks.map((b) => [
        `${b.makeModel}||${b.itemCategory}||${b.kmBucket}||${b.currency}`,
        b,
      ]),
    );

    const result: BenchmarkComparison[] = [];
    for (const [key, g] of own) {
      // Legalább 2 saját adatpont kell egy értelmes saját mediánhoz.
      if (g.values.length < 2) continue;
      const bench = byKey.get(key);
      if (!bench) continue;
      const benchMedian = bench.medianUnitPrice.toNumber();
      if (benchMedian <= 0) continue;
      const tenantMedian = percentile(g.values, 50);
      const deltaPct = Math.round((tenantMedian / benchMedian - 1) * 100);
      result.push({
        makeModel: g.makeModel,
        itemCategory: g.itemCategory,
        kmBucket: g.kmBucket,
        currency: g.currency,
        tenantMedian: tenantMedian.toFixed(2),
        benchmarkMedian: benchMedian.toFixed(2),
        deltaPct,
        position: positionOf(deltaPct),
        sampleTenants: bench.sampleTenants,
        sampleVehicles: bench.sampleVehicles,
      });
    }

    // A legnagyobb eltérések elöl (a „piac felett" a legérdekesebb).
    return result.sort((a, b) => b.deltaPct - a.deltaPct);
  }

  // ── Visszahívások (ingyenes forrásból) ───────────────────────────────────────

  /** A cég járműveire vonatkozó visszahívások (egyedi márka-modellenként lekérve). */
  async getRecalls(): Promise<VehicleRecall[]> {
    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: { make: true, model: true, year: true },
    });

    // Egyedi (márka, modell, év) kombinációk – elkerüli a duplikált lekérést.
    const seenQuery = new Set<string>();
    const queries: { make: string | null; model: string | null; year: number | null }[] =
      [];
    for (const v of vehicles) {
      if (!v.make && !v.model) continue;
      const key = `${v.make ?? ''}|${v.model ?? ''}|${v.year ?? ''}`;
      if (seenQuery.has(key)) continue;
      seenQuery.add(key);
      queries.push({ make: v.make, model: v.model, year: v.year });
    }

    const byRef = new Map<string, VehicleRecall>();
    for (const q of queries) {
      try {
        const recalls = await this.recall.getRecalls(q);
        for (const r of recalls) byRef.set(r.reference, r);
      } catch (err) {
        this.logger.warn(`Recall lekérés hiba: ${(err as Error).message}`);
      }
    }
    return [...byRef.values()];
  }
}

// ── Segédfüggvények ───────────────────────────────────────────────────────────

type ItemForPrice = {
  unitPrice: Prisma.Decimal | null;
  price: Prisma.Decimal;
  quantity: number | null;
};

function unitPriceOf(item: ItemForPrice): number | null {
  if (item.unitPrice != null) return item.unitPrice.toNumber();
  const price = item.price.toNumber();
  const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
  return price / qty;
}

/** p-edik percentilis (lineáris interpoláció), p ∈ [0,100]. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] ?? 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const frac = rank - lo;
  return (sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
