import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  DocumentStatus,
  DocumentType,
  ItemCategory,
  ItemType,
  PLAN_LIMITS,
  PlanTier,
  SpreadsheetRowAction,
  SpreadsheetWarningCode,
  isSpreadsheetMimeType,
  isWithinLimit,
} from '@valloreg/shared';
import type {
  ExtractedItem,
  ExtractionResult,
  SpreadsheetImportCommitResult,
  SpreadsheetImportItem,
  SpreadsheetImportPreview,
  SpreadsheetImportRow,
} from '@valloreg/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../../audit/audit.service';
import { MatchingService } from '../../matching/matching.service';
import { InvoicePersistenceService } from '../../matching/invoice-persistence.service';
import { AppException } from '../../common/exceptions/app.exception';
import { EXTRACTION_PROVIDER, type ExtractionProvider } from '../../extraction/extraction.provider';
import {
  SpreadsheetParserService,
  guessPartType,
  rowKey,
  type ParsedWorkbook,
} from './spreadsheet-parser.service';
import type { UploadedDocumentFile } from '../documents.service';

/** Rendszám-normalizálás az illesztéshez (csak betű/szám, nagybetű). */
function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Excel köteges számla-import. KÜLÖN út a kép-OCR pipeline-tól: a táblázat
 * cellái már strukturáltak, ezért előnézet → megerősítés folyamatban dolgozunk,
 * és egy fájl SOK számlát hozhat létre.
 *
 * A felismert sorokat ugyanarra az `ExtractionResult` alakra képezzük, mint az
 * OCR-motor, így a beszállító-/jármű-matching és a perzisztálás (Invoice +
 * InvoiceItem + javaslatok) közös kóddal fut.
 */
@Injectable()
export class SpreadsheetImportService {
  private readonly logger = new Logger(SpreadsheetImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly parser: SpreadsheetParserService,
    private readonly matching: MatchingService,
    private readonly invoicePersistence: InvoicePersistenceService,
    @Inject(EXTRACTION_PROVIDER)
    private readonly extraction: ExtractionProvider,
  ) {}

  /** Előnézet: parse + jármű-illesztés + duplikátum-jelölés (NEM ír semmit). */
  async preview(file: UploadedDocumentFile | undefined): Promise<SpreadsheetImportPreview> {
    const parsed = await this.analyze(file);
    return this.toPreview(parsed);
  }

  /** Véglegesítés: a CREATE sorokból Document + Invoice + tételek létrejönnek. */
  async commit(
    tenantId: string,
    userId: string,
    file: UploadedDocumentFile | undefined,
  ): Promise<SpreadsheetImportCommitResult> {
    const buffer = this.requireBuffer(file);
    const parsed = await this.analyze(file);
    const createRows = parsed.rows.filter((r) => r.action === SpreadsheetRowAction.CREATE);

    let created = 0;
    let skipped = 0;
    const errors: SpreadsheetImportCommitResult['errors'] = [];

    if (createRows.length === 0) {
      return { created, skipped, errors };
    }

    // Havi dokumentum-limit: minden létrehozandó sor egy Document.
    await this.assertMonthlyDocumentLimit(tenantId, createRows.length);

    // A fájlt EGYSZER tároljuk; minden sor-Document ugyanarra a kulcsra mutat.
    const fileSha = createHash('sha256').update(buffer).digest('hex');
    const storageKey = this.storage.buildDocumentKey(
      tenantId,
      `import-${fileSha.slice(0, 16)}`,
      file!.originalname,
    );
    let fileStored = false;

    for (const row of createRows) {
      try {
        const rowSha = this.rowSha256(fileSha, row);

        // Idempotencia: ugyanez a sor (fájl + tartalom) már importálva volt?
        const existing = await this.prisma.scoped.document.findFirst({
          where: { sha256: rowSha },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        if (!fileStored) {
          await this.storage.upload(
            storageKey,
            buffer,
            file!.mimetype || 'application/octet-stream',
          );
          fileStored = true;
        }

        const extraction = await this.buildExtraction(tenantId, row, parsed.rawItems);
        const documentId = randomUUID();

        const status =
          row.warnings.length > 0 ? DocumentStatus.NEEDS_REVIEW : DocumentStatus.AUTO_OK;

        await this.prisma.scoped.document.create({
          data: {
            tenantId,
            uploadedById: userId,
            // A fájl egyszer tárolt; csak az ELSŐ sor "viszi" a méretet a
            // tárhely-elszámolásban (a többi ugyanarra a kulcsra mutat).
            fileName: `${file!.originalname} · ${row.sheet} #${row.rowNumber}`,
            mimeType: file!.mimetype || 'application/octet-stream',
            sizeBytes: created === 0 ? file!.size : 0,
            storageKey,
            sha256: rowSha,
            status,
            docType: DocumentType.INVOICE,
          },
        });

        const supplierId = await this.matching.resolveSupplierId(
          tenantId,
          extraction.invoice.supplier,
        );
        const vehicleMatch = await this.matching.resolveVehicleForInvoice(
          tenantId,
          extraction,
          supplierId,
        );
        await this.invoicePersistence.persist(
          tenantId,
          documentId,
          extraction,
          supplierId,
          vehicleMatch,
        );

        created++;
      } catch (err) {
        // Egyedi-kulcs ütközés (párhuzamos import) → kihagyás, nem hiba.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          skipped++;
          continue;
        }
        const message = err instanceof AppException ? err.message : 'Sikertelen mentés.';
        errors.push({ sheet: row.sheet, rowNumber: row.rowNumber, message });
      }
    }

    await this.audit.log({
      tenantId,
      userId,
      action: 'document.spreadsheet_imported',
      resourceType: 'Document',
      metadata: {
        fileName: file!.originalname,
        created,
        skipped,
        errors: errors.length,
        rows: createRows.length,
      },
    });

    return { created, skipped, errors };
  }

  // ── Belső ────────────────────────────────────────────────────────────────

  /** Fájl-validáció + parse + jármű-illesztés + duplikátum-jelölés. */
  private async analyze(file: UploadedDocumentFile | undefined): Promise<ParsedWorkbook> {
    const buffer = this.requireBuffer(file);
    const mime = file!.mimetype || '';
    const ext = (file!.originalname.split('.').pop() ?? '').toLowerCase();
    if (!isSpreadsheetMimeType(mime) && ext !== 'xlsx' && ext !== 'xls') {
      throw AppException.unsupportedSpreadsheetType();
    }

    const parsed = await this.parser.parse(buffer);
    if (parsed.rows.length === 0) {
      throw AppException.spreadsheetNoData();
    }

    // Jármű-illesztés a fül-névben sejtett rendszám alapján (tenant-scope).
    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: { id: true, plate: true },
    });
    const byPlate = new Map<string, string>();
    for (const v of vehicles) {
      if (v.plate) byPlate.set(normalizePlate(v.plate), v.id);
    }

    // Duplikátum-jelölés: a már importált sorok (fájl + tartalom hash).
    const fileSha = createHash('sha256').update(buffer).digest('hex');
    const rowShas = parsed.rows.map((r) => this.rowSha256(fileSha, r));
    const existing = await this.prisma.scoped.document.findMany({
      where: { sha256: { in: rowShas } },
      select: { sha256: true },
    });
    const existingShas = new Set(existing.map((e) => e.sha256));

    for (const row of parsed.rows) {
      const matchedVehicleId = row.vehiclePlate
        ? (byPlate.get(normalizePlate(row.vehiclePlate)) ?? null)
        : null;
      row.matchedVehicleId = matchedVehicleId;
      if (!matchedVehicleId && !row.warnings.includes(SpreadsheetWarningCode.MISSING_VEHICLE)) {
        row.warnings.push(SpreadsheetWarningCode.MISSING_VEHICLE);
      }
      if (existingShas.has(this.rowSha256(fileSha, row))) {
        row.action = SpreadsheetRowAction.DUPLICATE;
      }
    }

    // A munkalap-összegzések jármű-id-jét is feltöltjük (az első egyező sorból).
    for (const sheet of parsed.sheets) {
      if (sheet.vehiclePlate) {
        sheet.matchedVehicleId = byPlate.get(normalizePlate(sheet.vehiclePlate)) ?? null;
      }
    }

    return parsed;
  }

  /** A parser kimenetéből az API-előnézet (a belső rawItems nélkül). */
  private toPreview(parsed: ParsedWorkbook): SpreadsheetImportPreview {
    const rows = parsed.rows;
    return {
      sheets: parsed.sheets,
      rows,
      summary: {
        total: rows.length,
        create: rows.filter((r) => r.action === SpreadsheetRowAction.CREATE).length,
        duplicate: rows.filter((r) => r.action === SpreadsheetRowAction.DUPLICATE).length,
        skip: rows.filter((r) => r.action === SpreadsheetRowAction.SKIP).length,
        withWarnings: rows.filter((r) => r.warnings.length > 0).length,
      },
    };
  }

  /** Egy előnézeti sorból `ExtractionResult` (a perzisztáláshoz). */
  private async buildExtraction(
    tenantId: string,
    row: SpreadsheetImportRow,
    rawItems: Map<string, string>,
  ): Promise<ExtractionResult> {
    // A fül-névből/illesztésből jött jármű erős jelölt a matchinghez.
    const isVehicle = row.vehiclePlate !== null || row.matchedVehicleId !== null;

    let items = row.items.map((it) => this.toExtractedItem(it, isVehicle));

    // HIBRID: ha a determinisztikus bontás gyenge volt (nincs / bizonytalan
    // tétel), és gemini-provider van beállítva, az AI finomítja a tétel-listát.
    const needsAi =
      row.warnings.includes(SpreadsheetWarningCode.NO_ITEMS) ||
      row.warnings.includes(SpreadsheetWarningCode.UNPARSED_ITEMS);
    if (needsAi && this.config.extractionProvider === 'gemini') {
      const rawCell = rawItems.get(rowKey(row.sheet, row.rowNumber)) ?? '';
      const refined = await this.refineItemsWithAi(tenantId, row, rawCell);
      if (refined && refined.length > 0) items = refined;
    }

    // A figyelmeztetések száma alapján mért fej-confidence (kevesebb = magasabb).
    const confidence = Math.max(0.3, Math.min(0.95, 0.9 - row.warnings.length * 0.1));

    return {
      documentType: DocumentType.INVOICE,
      invoice: {
        supplier: row.supplier,
        date: row.date,
        invoiceNumber: row.invoiceNumber,
        currency: row.currency,
        odometerKm: row.odometerKm,
        netTotal: null,
        taxTotal: null,
        grossTotal: row.grossTotal,
        vehicleCandidates: row.vehiclePlate
          ? [
              {
                plate: row.vehiclePlate,
                vin: null,
                vehicleId: row.matchedVehicleId,
                source: 'plate',
                confidence: row.matchedVehicleId ? 0.9 : 0.3,
              },
            ]
          : [],
        confidence,
      },
      items,
      uncertainFields: [],
    };
  }

  /** Egy import-tétel → `ExtractedItem` (kategória/típus heurisztikával). */
  private toExtractedItem(item: SpreadsheetImportItem, isVehicleSheet: boolean): ExtractedItem {
    const partType = isVehicleSheet ? guessPartType(item.name) : null;
    return {
      name: item.name,
      category: isVehicleSheet ? ItemCategory.PART : ItemCategory.OTHER,
      partType: partType as ExtractedItem['partType'],
      articleNumber: item.articleNumber,
      type: isVehicleSheet ? ItemType.VEHICLE : ItemType.GENERAL,
      vehicleId: null,
      quantity: item.quantity,
      unitPrice: null,
      price: 0,
      confidence: item.confidence,
    };
  }

  /**
   * AI-finomítás a kusza tétel-cellára: a nyers szövegből az ExtractionProvider
   * (gemini) strukturált tételeket ad. Best-effort: hiba esetén null (a
   * determinisztikus eredményt tartjuk meg).
   */
  private async refineItemsWithAi(
    tenantId: string,
    row: SpreadsheetImportRow,
    rawCell: string,
  ): Promise<ExtractedItem[] | null> {
    try {
      // Elsődlegesen a NYERS cellaszöveget adjuk az AI-nak; ha nincs, a már
      // kiolvasott tétel-megnevezésekből építünk blokkot.
      const lines = rawCell
        ? rawCell.split(/\r?\n/)
        : row.items.map((it) => [it.articleNumber, it.name, it.quantity].filter(Boolean).join(' '));
      const text = [
        `Furnizor: ${row.supplier}`,
        `Factura: ${row.invoiceNumber}`,
        'Piese:',
        ...lines,
      ].join('\n');
      const result = await this.extraction.extract(text, {
        tenantId,
        documentId: `xlsx:${row.sheet}:${row.rowNumber}`,
      });
      return result.items.length > 0 ? result.items : null;
    } catch (err) {
      this.logger.warn(
        `AI tétel-finomítás sikertelen (${row.sheet}#${row.rowNumber}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /** Sor-szintű sha256 (fájl-hash + munkalap + sor + kanonikus tartalom). */
  private rowSha256(fileSha: string, row: SpreadsheetImportRow): string {
    const canonical = JSON.stringify({
      d: row.date,
      i: row.invoiceNumber,
      s: row.supplier,
      g: row.grossTotal,
      k: row.odometerKm,
      it: row.items.map((x) => [x.articleNumber, x.name, x.quantity]),
    });
    return createHash('sha256')
      .update(`${fileSha}:${row.sheet}:${row.rowNumber}:${canonical}`)
      .digest('hex');
  }

  /** Havi (naptári hónap) feldolgozott dokumentum-limit a létrehozandó sorokra. */
  private async assertMonthlyDocumentLimit(tenantId: string, creating: number): Promise<void> {
    const subscription = await this.prisma.system.subscription.findUnique({
      where: { tenantId },
      select: { planTier: true },
    });
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limit = PLAN_LIMITS[planTier].maxDocumentsPerMonth;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await this.prisma.scoped.document.count({
      where: { createdAt: { gte: monthStart } },
    });

    if (!isWithinLimit(count + creating - 1, limit)) {
      throw AppException.documentsLimitReached();
    }
  }

  private requireBuffer(file: UploadedDocumentFile | undefined): Buffer {
    if (!file?.buffer?.length) {
      throw AppException.validation('Hiányzik a feltöltendő táblázat.');
    }
    return file.buffer;
  }
}
