import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { VehicleScanStatus } from '@valloreg/shared';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OCR_PROVIDER } from '../ocr/ocr.provider';
import type { OcrProvider } from '../ocr/ocr.provider';
import { VEHICLE_EXTRACTION_PROVIDER } from '../extraction/vehicle-extraction.provider';
import type { VehicleExtractionProvider } from '../extraction/vehicle-extraction.provider';
import {
  ProcessVehicleScanJobData,
  VEHICLE_SCANS_QUEUE,
} from './queue.constants';

/** Egy staging fájl hivatkozása (a VehicleScan.files JSON-tömb eleme). */
interface ScanFileRef {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * A `vehicle-scans` queue worker-e: a stagingbe töltött forgalmi-engedély
 * fájl(oka)t OCR-ezi, AI-val kiolvassa, meglévő járműre illeszti, és az
 * eredményt a VehicleScan rekordba írja. A kliens innen pollingol.
 *
 * FONTOS: a worker NEM request-kontextusban fut – a SYSTEM Prisma klienst
 * használja, és a tenantId-t MINDEN where/data-ban EXPLICITEN megadja.
 *
 * Idempotencia: ha a scan státusza már terminál (DONE/FAILED), a job no-op.
 */
@Injectable()
export class VehicleScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VehicleScanProcessor.name);
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    @Inject(VEHICLE_EXTRACTION_PROVIDER)
    private readonly vehicleExtraction: VehicleExtractionProvider,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ProcessVehicleScanJobData>(
      VEHICLE_SCANS_QUEUE,
      (job) => this.process(job),
      { connection: this.config.redis, concurrency: 2 },
    );
    this.worker.on('error', (err) => {
      this.logger.warn(`Vehicle-scan worker hiba: ${err.message}`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job sikertelen (${job?.id}): ${err.message}`, err.stack);
    });
    this.logger.log('Vehicle-scan worker elindult.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<ProcessVehicleScanJobData>): Promise<void> {
    const { tenantId, scanId, locale } = job.data;

    const scan = await this.prisma.system.vehicleScan.findFirst({
      where: { id: scanId, tenantId },
    });
    if (!scan) {
      this.logger.warn(`Beolvasás nem található (id: ${scanId}) – kihagyva.`);
      return;
    }

    const terminal: string[] = [VehicleScanStatus.DONE, VehicleScanStatus.FAILED];
    if (terminal.includes(scan.status)) {
      this.logger.log(`Beolvasás már feldolgozott (${scan.status}) – kihagyás.`);
      return;
    }

    const files = (scan.files as unknown as ScanFileRef[]) ?? [];

    try {
      // 1) OCR az összes staging fájlon.
      await this.setStatus(tenantId, scanId, VehicleScanStatus.OCR_RUNNING);
      const texts: string[] = [];
      for (const f of files) {
        const ocr = await this.ocr.recognize({
          storageKey: f.storageKey,
          mimeType: f.mimeType,
          tenantId,
          documentId: scanId,
        });
        texts.push(ocr.text);
      }

      // 2) AI kiolvasás (forgalmi engedély → draft mezők).
      await this.setStatus(tenantId, scanId, VehicleScanStatus.EXTRACTING);
      const draft = await this.vehicleExtraction.extractVehicle(
        texts.join('\n\n'),
        { tenantId, locale },
      );

      // 3) Meglévő jármű illesztése (rendszám/VIN) + forgalmi-felismerés.
      const matchedVehicleId = await this.findMatchingVehicle(
        tenantId,
        draft.plate,
        draft.vin,
      );
      const looksLikeRegistration = Boolean(
        (draft.plate && draft.plate.trim()) || (draft.vin && draft.vin.trim()),
      );

      // 4) Eredmény perzisztálása + DONE.
      await this.prisma.system.vehicleScan.updateMany({
        where: { id: scanId, tenantId },
        data: {
          status: VehicleScanStatus.DONE,
          draft: draft as unknown as Prisma.InputJsonValue,
          matchedVehicleId,
          looksLikeRegistration,
          error: null,
        },
      });

      await this.audit.log({
        tenantId,
        action: 'vehicle.scanned',
        resourceType: 'VehicleScan',
        resourceId: scanId,
        metadata: {
          fileCount: files.length,
          confidence: draft.confidence,
          matchedVehicleId,
          looksLikeRegistration,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.system.vehicleScan.updateMany({
        where: { id: scanId, tenantId },
        data: { status: VehicleScanStatus.FAILED, error: message },
      });
      await this.audit.log({
        tenantId,
        action: 'vehicle.scan_failed',
        resourceType: 'VehicleScan',
        resourceId: scanId,
        metadata: { error: message },
      });
      throw err; // BullMQ retry/backoff
    }
  }

  private async setStatus(
    tenantId: string,
    scanId: string,
    status: VehicleScanStatus,
  ): Promise<void> {
    await this.prisma.system.vehicleScan.updateMany({
      where: { id: scanId, tenantId },
      data: { status },
    });
  }

  /** Rendszám/VIN alapú egyezés a meglévő járművekkel (frissítés-javaslathoz). */
  private async findMatchingVehicle(
    tenantId: string,
    plate: string | null,
    vin: string | null,
  ): Promise<string | null> {
    const normPlate = plate ? normalizePlate(plate) : '';
    const normVin = vin ? normalizeVin(vin) : '';
    if (!normPlate && !normVin) return null;

    const vehicles = await this.prisma.system.vehicle.findMany({
      where: { tenantId },
      select: { id: true, plate: true, vin: true },
    });
    for (const v of vehicles) {
      if (normVin && v.vin && normalizeVin(v.vin) === normVin) return v.id;
      if (normPlate && v.plate && normalizePlate(v.plate) === normPlate) {
        return v.id;
      }
    }
    return null;
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
