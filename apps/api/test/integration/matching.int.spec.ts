import { randomUUID } from 'node:crypto';
import { TenantRole } from '@valloreg/shared';
import type { ExtractionResult } from '@valloreg/shared';
import { MatchingService } from '../../src/matching/matching.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { cleanup, makePrisma, seedTenant } from './helpers';

/**
 * Integrációs teszt a jármű-matching motorhoz, ÉLŐ Postgreshez.
 *
 * FONTOS: ez a teszt csak CI-ben fut (generált @prisma/client + migrált DB kell).
 * A `MatchingService` a worker-szerű `prisma.system` (nem scope-olt) klienst
 * használja, ezért MINDEN seed és lekérdezés EXPLICIT tenantId-vel megy – nincs
 * tenant AsyncLocalStorage kontextus.
 *
 * A `resolveVehicleForInvoice` az ExtractionResult-ból CSAK az
 * `invoice.vehicleCandidates` tömböt olvassa, ezért a teszt-extraction-öket
 * minimálisan, `as unknown as ExtractionResult` cast-tal építjük.
 */

/** Determinisztikus, de egyedi rendszám (a párhuzamos CI-futás ne ütközzön). */
function makePlate(): string {
  return `IT-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/** Determinisztikus, de egyedi VIN (a párhuzamos CI-futás ne ütközzön). */
function makeVin(): string {
  return `VIN${randomUUID().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
}

/** Minimális ExtractionResult a megadott jármű-jelöltekből. */
function extractionFrom(
  candidates: Array<{ plate?: string; vin?: string }>,
): ExtractionResult {
  return {
    invoice: { vehicleCandidates: candidates },
  } as unknown as ExtractionResult;
}

describe('MatchingService (integráció, élő Postgres)', () => {
  let prisma: PrismaService;
  let service: MatchingService;

  // Takarításhoz gyűjtjük a seedelt id-ket.
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const made = makePrisma();
    prisma = made.prisma;
    await prisma.onModuleInit();
    service = new MatchingService(prisma);
  });

  afterAll(async () => {
    await cleanup(prisma, { tenantIds, userIds });
    await prisma.onModuleDestroy();
  });

  /** Seedel egy izolált tenantot és nyilvántartja a takarításhoz. */
  async function freshTenant(): Promise<string> {
    const seeded = await seedTenant(prisma, TenantRole.OWNER);
    tenantIds.push(seeded.tenantId);
    userIds.push(seeded.userId);
    return seeded.tenantId;
  }

  describe('resolveSupplierId', () => {
    it('üres név → null', async () => {
      const tenantId = await freshTenant();
      await expect(service.resolveSupplierId(tenantId, '')).resolves.toBeNull();
    });

    it('csak whitespace név → null', async () => {
      const tenantId = await freshTenant();
      await expect(
        service.resolveSupplierId(tenantId, '   '),
      ).resolves.toBeNull();
    });

    it('új név → létrejön a beszállító és visszajön az id', async () => {
      const tenantId = await freshTenant();

      const id = await service.resolveSupplierId(tenantId, 'AutoFix Kft');

      expect(id).toBeTruthy();
      const row = await prisma.system.supplier.findFirst({
        where: { tenantId, id: id! },
        select: { id: true, name: true, normalizedName: true },
      });
      expect(row).not.toBeNull();
      expect(row!.name).toBe('AutoFix Kft');
      expect(row!.normalizedName).toBe('autofix kft');
    });

    it('ugyanaz a név más kis/nagybetűvel és szóközzel → UGYANAZ az id (find, nem új create)', async () => {
      const tenantId = await freshTenant();

      const first = await service.resolveSupplierId(tenantId, 'AutoFix Kft');
      // Eltérő kis/nagybetű + dupla szóköz → ugyanaz a normalizált név.
      const second = await service.resolveSupplierId(
        tenantId,
        '  autofix   KFT  ',
      );

      expect(second).toBe(first);

      const count = await prisma.system.supplier.count({ where: { tenantId } });
      expect(count).toBe(1);
    });
  });

  describe('resolveVehicleForInvoice', () => {
    it('VIN-jelölt egyezik egy jármű vin-jével → source vin, confidence 0.98', async () => {
      const tenantId = await freshTenant();
      const vin = makeVin();
      const vehicle = await prisma.system.vehicle.create({
        data: { tenantId, vin, plate: makePlate() },
        select: { id: true },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ vin }]),
        null,
      );

      expect(result).toEqual({
        vehicleId: vehicle.id,
        source: 'vin',
        confidence: 0.98,
      });
    });

    it('csak rendszám-jelölt egyezik → source plate, confidence 0.95', async () => {
      const tenantId = await freshTenant();
      const plate = makePlate();
      const vehicle = await prisma.system.vehicle.create({
        data: { tenantId, plate, vin: makeVin() },
        select: { id: true },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ plate }]),
        null,
      );

      expect(result).toEqual({
        vehicleId: vehicle.id,
        source: 'plate',
        confidence: 0.95,
      });
    });

    it('VIN és rendszám is megadva (akár külön járművel) → a VIN nyer', async () => {
      const tenantId = await freshTenant();
      const vin = makeVin();
      const plate = makePlate();

      const vinVehicle = await prisma.system.vehicle.create({
        data: { tenantId, vin, plate: makePlate() },
        select: { id: true },
      });
      // Külön jármű, amelynek csak a rendszáma egyezik.
      await prisma.system.vehicle.create({
        data: { tenantId, plate, vin: makeVin() },
        select: { id: true },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ vin, plate }]),
        null,
      );

      // A VIN prioritást élvez a rendszám felett.
      expect(result).toEqual({
        vehicleId: vinVehicle.id,
        source: 'vin',
        confidence: 0.98,
      });
    });

    it('normalizálás: "abc 123" jelölt egyezik a "ABC-123" rendszámú járművel', async () => {
      const tenantId = await freshTenant();
      const vehicle = await prisma.system.vehicle.create({
        data: { tenantId, plate: 'ABC-123', vin: makeVin() },
        select: { id: true },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ plate: 'abc 123' }]),
        null,
      );

      expect(result).toEqual({
        vehicleId: vehicle.id,
        source: 'plate',
        confidence: 0.95,
      });
    });

    it('nincs jelölt-egyezés, de van EGYETLEN supplier→vehicle mapping → source supplier_pattern, confidence 0.6', async () => {
      const tenantId = await freshTenant();

      const vehicle = await prisma.system.vehicle.create({
        data: { tenantId, plate: makePlate(), vin: makeVin() },
        select: { id: true },
      });
      const supplier = await prisma.system.supplier.create({
        data: { tenantId, name: 'Tanuló Bt', normalizedName: 'tanuló bt' },
        select: { id: true },
      });
      await prisma.system.supplierVehicleMapping.create({
        data: { tenantId, supplierId: supplier.id, vehicleId: vehicle.id, weight: 1 },
      });

      // A jelölt nem egyezik (random, nem létező VIN), így a supplier-tanulás dönt.
      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ vin: makeVin() }]),
        supplier.id,
      );

      expect(result).toEqual({
        vehicleId: vehicle.id,
        source: 'supplier_pattern',
        confidence: 0.6,
      });
    });

    it('két mapping, top.weight >= 2*second.weight → source history, confidence 0.55', async () => {
      const tenantId = await freshTenant();

      const dominant = await prisma.system.vehicle.create({
        data: { tenantId, plate: makePlate(), vin: makeVin() },
        select: { id: true },
      });
      const other = await prisma.system.vehicle.create({
        data: { tenantId, plate: makePlate(), vin: makeVin() },
        select: { id: true },
      });
      const supplier = await prisma.system.supplier.create({
        data: { tenantId, name: 'Domináns Bt', normalizedName: 'domináns bt' },
        select: { id: true },
      });
      // top weight 4 >= 2 * 2 → domináns.
      await prisma.system.supplierVehicleMapping.create({
        data: { tenantId, supplierId: supplier.id, vehicleId: dominant.id, weight: 4 },
      });
      await prisma.system.supplierVehicleMapping.create({
        data: { tenantId, supplierId: supplier.id, vehicleId: other.id, weight: 2 },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ vin: makeVin() }]),
        supplier.id,
      );

      expect(result).toEqual({
        vehicleId: dominant.id,
        source: 'history',
        confidence: 0.55,
      });
    });

    it('két mapping egyenlő súllyal (nem domináns) → nincs egyezés (null match)', async () => {
      const tenantId = await freshTenant();

      const a = await prisma.system.vehicle.create({
        data: { tenantId, plate: makePlate(), vin: makeVin() },
        select: { id: true },
      });
      const b = await prisma.system.vehicle.create({
        data: { tenantId, plate: makePlate(), vin: makeVin() },
        select: { id: true },
      });
      const supplier = await prisma.system.supplier.create({
        data: { tenantId, name: 'Egyenlő Bt', normalizedName: 'egyenlő bt' },
        select: { id: true },
      });
      // Egyenlő súlyok → top.weight (2) < 2 * second.weight (4) → nem domináns.
      await prisma.system.supplierVehicleMapping.create({
        data: { tenantId, supplierId: supplier.id, vehicleId: a.id, weight: 2 },
      });
      await prisma.system.supplierVehicleMapping.create({
        data: { tenantId, supplierId: supplier.id, vehicleId: b.id, weight: 2 },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ vin: makeVin() }]),
        supplier.id,
      );

      expect(result).toEqual({
        vehicleId: null,
        source: null,
        confidence: 0,
      });
    });

    it('semmi nem egyezik → { vehicleId: null, source: null, confidence: 0 }', async () => {
      const tenantId = await freshTenant();
      // Van jármű, de a jelölt se VIN-re, se rendszámra nem egyezik, és nincs supplier.
      await prisma.system.vehicle.create({
        data: { tenantId, plate: makePlate(), vin: makeVin() },
        select: { id: true },
      });

      const result = await service.resolveVehicleForInvoice(
        tenantId,
        extractionFrom([{ vin: makeVin(), plate: makePlate() }]),
        null,
      );

      expect(result).toEqual({
        vehicleId: null,
        source: null,
        confidence: 0,
      });
    });
  });
});
