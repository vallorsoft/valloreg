import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  isAllowedDocumentMimeType,
  isWithinLimit,
  MAX_DOCUMENT_SIZE_BYTES,
  PLAN_LIMITS,
  PlanTier,
  type VehicleRegistrationResult,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';
import { OCR_PROVIDER } from '../ocr/ocr.provider';
import type { OcrProvider } from '../ocr/ocr.provider';
import { VEHICLE_EXTRACTION_PROVIDER } from '../extraction/vehicle-extraction.provider';
import type { VehicleExtractionProvider } from '../extraction/vehicle-extraction.provider';
import type { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { ConfirmScanDto } from './dto/confirm-scan.dto';

/** Egy feltöltött fájl (multer memory storage). */
export interface UploadedScanFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Egy beolvasott (staging) fájl leírója – a confirm ezzel köti a járműhöz. */
export interface ScanFileRef {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface VehicleScanResult {
  draft: VehicleRegistrationResult;
  files: ScanFileRef[];
  /** Ha a rendszám/VIN már létező járműre illik (frissítés ajánlott). */
  matchedVehicleId: string | null;
}

/** Egy CSV-import sor elemzési eredménye. */
export interface ImportRowResult {
  /** A sor száma a fájlban (1-alapú, a fejléc utáni). */
  index: number;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  odometerKm: number | null;
  /** create = új; update = meglévő (rendszám/VIN egyezés); error = hibás sor. */
  action: 'create' | 'update' | 'error';
  vehicleId: string | null;
  errors: string[];
}

export interface ImportPreview {
  rows: ImportRowResult[];
  summary: { total: number; create: number; update: number; error: number };
}

export interface ImportCommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { index: number; message: string }[];
}

/** A jármű-scan staging S3 prefixe (a confirm csak ezen belüli kulcsot fogad el). */
const SCAN_PREFIX = 'vehicle-scans';

/**
 * Jármű CRUD + forgalmi-engedély beolvasás (OCR + AI). A Vehicle modell
 * tenant-scope-olt; a scoped kliens szűri/tölti a tenantId-t.
 */
@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(VEHICLE_EXTRACTION_PROVIDER)
    private readonly vehicleExtraction: VehicleExtractionProvider,
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

  /**
   * Jármű szerviztörténete: minden hozzárendelt számlatétel a számla
   * metaadataival (dátum, beszállító, számlaszám), valamint összegzés
   * (összköltség, tétel- és számlaszám, utolsó szerviz dátuma).
   */
  async getServiceHistory(id: string) {
    const vehicle = await this.getById(id); // tenant-scope-olt létezés-ellenőrzés

    const items = await this.prisma.scoped.invoiceItem.findMany({
      where: { vehicleId: id },
      include: {
        invoice: {
          select: {
            id: true,
            documentId: true,
            invoiceNumber: true,
            date: true,
            currency: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Összegzés + legutóbbi szerviz dátuma.
    let totalSpent = new Prisma.Decimal(0);
    let lastServiceDate: Date | null = null;
    const invoiceIds = new Set<string>();
    let currency: string | null = null;
    for (const item of items) {
      totalSpent = totalSpent.add(item.price);
      invoiceIds.add(item.invoiceId);
      const date = item.invoice?.date ?? null;
      if (date && (!lastServiceDate || date > lastServiceDate)) {
        lastServiceDate = date;
      }
      if (!currency && item.invoice?.currency) currency = item.invoice.currency;
    }

    // Legújabb szerviz elöl (számla dátuma, majd a tétel létrehozása szerint).
    const sorted = [...items].sort((a, b) => {
      const da = a.invoice?.date ? new Date(a.invoice.date).getTime() : 0;
      const db = b.invoice?.date ? new Date(b.invoice.date).getTime() : 0;
      if (db !== da) return db - da;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return {
      vehicle,
      summary: {
        totalSpent: totalSpent.toString(),
        itemCount: items.length,
        invoiceCount: invoiceIds.size,
        lastServiceDate,
        currency,
      },
      items: sorted,
    };
  }

  async create(tenantId: string, userId: string, dto: CreateVehicleDto) {
    await this.assertVehicleLimit(tenantId);

    const vehicle = await this.prisma.scoped.vehicle.create({
      // tenantId-t a scoped kliens is injektálja; explicit átadjuk a típus-
      // biztonságért (az érték azonos, így nincs ütközés).
      data: {
        tenantId,
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

    // A járműhöz tartozó tárolt fájlok kulcsai (a DB cascade törli a sorokat,
    // de az S3 fájlt expliciten kell takarítani).
    const docs = await this.prisma.scoped.vehicleDocument.findMany({
      where: { vehicleId: id },
      select: { storageKey: true },
    });

    await this.prisma.scoped.vehicle.delete({ where: { id } });

    // Best-effort tárhely-takarítás (a jármű DB-ből már törlődött).
    for (const doc of docs) {
      try {
        await this.storage.delete(doc.storageKey);
      } catch (err) {
        this.logger.warn(
          `Jármű-dokumentum fájl törlése sikertelen (${doc.storageKey}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.deleted',
      resourceType: 'Vehicle',
      resourceId: id,
    });
  }

  // ── Forgalmi engedély beolvasás (OCR + AI) ──────────────────────────────────

  /**
   * Forgalmi engedély (1–2 kép vagy PDF) beolvasása: feltöltés a staging
   * tárhelyre → OCR → AI kiolvasás → draft mezők. NEM ment járművet; a felhasználó
   * az ellenőrzött adatokkal a `confirmScan`-t hívja. Ha a rendszám/VIN már létező
   * járműre illik, a `matchedVehicleId` frissítést javasol.
   */
  async scanRegistration(
    tenantId: string,
    userId: string,
    files: UploadedScanFile[] | undefined,
    locale?: string,
  ): Promise<VehicleScanResult> {
    if (!files || files.length === 0) {
      throw AppException.validation('Hiányzik a beolvasandó fájl.');
    }

    const scanId = randomUUID();
    const staged: ScanFileRef[] = [];
    const texts: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const mimeType = file.mimetype || 'application/octet-stream';
      if (!isAllowedDocumentMimeType(mimeType)) {
        throw AppException.unsupportedDocumentType();
      }
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        throw AppException.documentTooLarge();
      }

      const storageKey = `tenants/${tenantId}/${SCAN_PREFIX}/${scanId}/${i}`;
      await this.storage.upload(storageKey, file.buffer, mimeType);

      const ocr = await this.ocr.recognize({
        storageKey,
        mimeType,
        tenantId,
        documentId: scanId,
      });
      texts.push(ocr.text);
      staged.push({
        storageKey,
        fileName: file.originalname,
        mimeType,
        sizeBytes: file.size,
      });
    }

    const draft = await this.vehicleExtraction.extractVehicle(
      texts.join('\n\n'),
      { tenantId, locale },
    );

    const matchedVehicleId = await this.findMatchingVehicle(
      draft.plate,
      draft.vin,
    );

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.scanned',
      resourceType: 'Vehicle',
      metadata: {
        fileCount: files.length,
        confidence: draft.confidence,
        matchedVehicleId,
      },
    });

    return { draft, files: staged, matchedVehicleId };
  }

  /**
   * A beolvasott (ellenőrzött) adatok mentése: új jármű létrehozása, vagy meglévő
   * frissítése (`vehicleId`), majd a beolvasott fájl(ok) hozzákötése a jármű
   * dokumentum-archívumához. A staging kulcsokat a tenant-prefix ELLENŐRZÉSE
   * védi (idegen kulcs nem köthető be).
   */
  async confirmScan(
    tenantId: string,
    userId: string,
    dto: ConfirmScanDto,
  ): Promise<{ id: string }> {
    const allowedPrefix = `tenants/${tenantId}/${SCAN_PREFIX}/`;
    for (const f of dto.files ?? []) {
      if (!f.storageKey.startsWith(allowedPrefix)) {
        throw AppException.forbidden('Érvénytelen fájlhivatkozás.');
      }
    }

    const fields: CreateVehicleDto = {
      plate: dto.plate,
      vin: dto.vin,
      make: dto.make,
      model: dto.model,
      year: dto.year,
      odometerKm: dto.odometerKm,
    };

    const vehicle = dto.vehicleId
      ? await this.update(tenantId, userId, dto.vehicleId, fields)
      : await this.create(tenantId, userId, fields);

    if (dto.files && dto.files.length > 0) {
      await this.prisma.scoped.vehicleDocument.createMany({
        data: dto.files.map((f) => ({
          tenantId,
          vehicleId: vehicle.id,
          kind: 'registration',
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          storageKey: f.storageKey,
        })),
      });
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.scan_confirmed',
      resourceType: 'Vehicle',
      resourceId: vehicle.id,
      metadata: { documentCount: dto.files?.length ?? 0, updated: !!dto.vehicleId },
    });

    return { id: vehicle.id };
  }

  /** Egy jármű csatolt dokumentumai (archívum). */
  async listDocuments(vehicleId: string) {
    await this.getById(vehicleId); // tenant-scope-olt létezés-ellenőrzés
    return this.prisma.scoped.vehicleDocument.findMany({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
  }

  /** Presigned letöltési URL egy jármű-dokumentumhoz. */
  async getDocumentDownloadUrl(
    vehicleId: string,
    docId: string,
  ): Promise<{ downloadUrl: string }> {
    const doc = await this.prisma.scoped.vehicleDocument.findFirst({
      where: { id: docId, vehicleId },
      select: { storageKey: true },
    });
    if (!doc) throw AppException.notFound('A dokumentum nem található.');
    const downloadUrl = await this.storage.presignGet(doc.storageKey);
    return { downloadUrl };
  }

  /** Rendszám/VIN alapú egyezés a meglévő járművekkel (frissítés-javaslathoz). */
  private async findMatchingVehicle(
    plate: string | null,
    vin: string | null,
  ): Promise<string | null> {
    const normPlate = plate ? normalizePlate(plate) : '';
    const normVin = vin ? normalizeVin(vin) : '';
    if (!normPlate && !normVin) return null;

    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: { id: true, plate: true, vin: true },
    });
    for (const v of vehicles) {
      if (normVin && v.vin && normalizeVin(v.vin) === normVin) return v.id;
      if (normPlate && v.plate && normalizePlate(v.plate) === normPlate)
        return v.id;
    }
    return null;
  }

  // ── CSV tömeges import ───────────────────────────────────────────────────────

  /** CSV előnézet: soronkénti validáció + create/update/error besorolás (nem ír). */
  async previewImport(
    file: UploadedScanFile | undefined,
  ): Promise<ImportPreview> {
    const rows = await this.analyzeImport(file);
    const summary = {
      total: rows.length,
      create: rows.filter((r) => r.action === 'create').length,
      update: rows.filter((r) => r.action === 'update').length,
      error: rows.filter((r) => r.action === 'error').length,
    };
    return { rows, summary };
  }

  /**
   * CSV véglegesítése: a hibátlan sorokat létrehozza/frissíti. A fájl a forrás
   * (újra validáljuk – nem bízunk kliens-adatban). A csomag jármű-limit
   * érvényesül (a limit felett a sorok kihagyásra kerülnek hibaüzenettel), és a
   * fájlon belüli duplikátumokat is kiszűrjük.
   */
  async commitImport(
    tenantId: string,
    userId: string,
    file: UploadedScanFile | undefined,
  ): Promise<ImportCommitResult> {
    const rows = await this.analyzeImport(file);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { index: number; message: string }[] = [];

    // Fájlon belüli duplikátum-figyelés (a már feldolgozott kulcsok).
    const seenPlate = new Set<string>();
    const seenVin = new Set<string>();

    for (const r of rows) {
      if (r.action === 'error') {
        skipped++;
        errors.push({ index: r.index, message: r.errors.join('; ') });
        continue;
      }

      const np = r.plate ? normalizePlate(r.plate) : '';
      const nv = r.vin ? normalizeVin(r.vin) : '';
      if ((np && seenPlate.has(np)) || (nv && seenVin.has(nv))) {
        skipped++;
        errors.push({ index: r.index, message: 'Duplikátum a fájlon belül.' });
        continue;
      }

      try {
        const dto = {
          plate: r.plate ?? undefined,
          vin: r.vin ?? undefined,
          make: r.make ?? undefined,
          model: r.model ?? undefined,
          year: r.year ?? undefined,
          odometerKm: r.odometerKm ?? undefined,
        };
        if (r.action === 'update' && r.vehicleId) {
          await this.update(tenantId, userId, r.vehicleId, dto);
          updated++;
        } else {
          await this.create(tenantId, userId, dto);
          created++;
        }
        if (np) seenPlate.add(np);
        if (nv) seenVin.add(nv);
      } catch (err) {
        skipped++;
        const message =
          err instanceof AppException ? err.message : 'Sikertelen mentés.';
        errors.push({ index: r.index, message });
      }
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'vehicle.imported',
      resourceType: 'Vehicle',
      metadata: { created, updated, skipped, total: rows.length },
    });

    return { created, updated, skipped, errors };
  }

  /** CSV beolvasás + soronkénti validáció + dedupe-besorolás (közös mag). */
  private async analyzeImport(
    file: UploadedScanFile | undefined,
  ): Promise<ImportRowResult[]> {
    if (!file?.buffer?.length) {
      throw AppException.validation('Hiányzik a CSV fájl.');
    }
    const text = file.buffer.toString('utf-8').replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const delimiter =
      (firstLine.match(/;/g)?.length ?? 0) >
      (firstLine.match(/,/g)?.length ?? 0)
        ? ';'
        : ',';

    const table = parseCsv(text, delimiter);
    if (table.length < 2) {
      throw AppException.validation('A CSV üres, vagy csak fejlécet tartalmaz.');
    }

    const header = (table[0] ?? []).map(normalizeHeader);
    const col = mapColumns(header);
    if (col.plate === undefined && col.vin === undefined) {
      throw AppException.validation(
        'Hiányzó kötelező oszlop: "plate" (rendszám) vagy "vin" (alvázszám).',
      );
    }

    const existing = await this.prisma.scoped.vehicle.findMany({
      select: { id: true, plate: true, vin: true },
    });
    const byPlate = new Map<string, string>();
    const byVin = new Map<string, string>();
    for (const v of existing) {
      if (v.plate) byPlate.set(normalizePlate(v.plate), v.id);
      if (v.vin) byVin.set(normalizeVin(v.vin), v.id);
    }

    const cell = (cells: string[], idx?: number): string =>
      idx === undefined ? '' : (cells[idx] ?? '').trim();

    const results: ImportRowResult[] = [];
    for (let i = 1; i < table.length; i++) {
      const cells = table[i] ?? [];
      if (cells.every((c) => c.trim() === '')) continue; // üres sor

      const plate = cell(cells, col.plate);
      const vin = cell(cells, col.vin);
      const make = cell(cells, col.make);
      const model = cell(cells, col.model);
      const yearRaw = cell(cells, col.year);
      const odoRaw = cell(cells, col.odometerKm);

      const errors: string[] = [];
      if (!plate && !vin) {
        errors.push('Rendszám vagy alvázszám kötelező.');
      }
      let year: number | null = null;
      if (yearRaw) {
        const n = parseInt(yearRaw, 10);
        if (isNaN(n) || n < 1900 || n > 2100) errors.push('Érvénytelen évjárat.');
        else year = n;
      }
      let odometerKm: number | null = null;
      if (odoRaw) {
        const n = parseInt(odoRaw.replace(/[\s.]/g, ''), 10);
        if (isNaN(n) || n < 0) errors.push('Érvénytelen km-állás.');
        else odometerKm = n;
      }

      let action: ImportRowResult['action'] = 'create';
      let vehicleId: string | null = null;
      if (errors.length > 0) {
        action = 'error';
      } else {
        const matched =
          (vin && byVin.get(normalizeVin(vin))) ||
          (plate && byPlate.get(normalizePlate(plate))) ||
          null;
        if (matched) {
          action = 'update';
          vehicleId = matched;
        }
      }

      results.push({
        index: i,
        plate: plate || null,
        vin: vin || null,
        make: make || null,
        model: model || null,
        year,
        odometerKm,
        action,
        vehicleId,
        errors,
      });
    }

    return results;
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

/** Rendszám normalizálása: csak betűk/számok, nagybetű (pl. "ABC-123" → "ABC123"). */
function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** VIN normalizálása: nagybetű, szóközök eltávolítva. */
function normalizeVin(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

/** Egyszerű, idézőjel-tűrő CSV-parser (RFC4180-szerű). */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Fejléc-cella normalizálása: kisbetű, ékezet-mentes, csak alfanumerikus. */
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Oszlopnevek → index leképezés (HU/RO/EN aliasokkal). */
function mapColumns(header: string[]): {
  plate?: number;
  vin?: number;
  make?: number;
  model?: number;
  year?: number;
  odometerKm?: number;
} {
  const aliases: Record<string, string[]> = {
    plate: ['plate', 'rendszam', 'platenumber', 'nr', 'numar', 'numarinmatriculare'],
    vin: ['vin', 'alvazszam', 'chassis', 'serie', 'seriesasiu'],
    make: ['make', 'gyartmany', 'marka', 'marca', 'brand'],
    model: ['model', 'tipus', 'modell'],
    year: ['year', 'evjarat', 'an', 'yearofmanufacture'],
    odometerKm: ['odometerkm', 'km', 'kilometer', 'kilometerora', 'kilometraj', 'odometer'],
  };
  const result: Record<string, number | undefined> = {};
  for (const [key, names] of Object.entries(aliases)) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx >= 0) result[key] = idx;
  }
  return result;
}
