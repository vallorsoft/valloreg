import { Injectable } from '@nestjs/common';
import type { ExtractionResult } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';

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
