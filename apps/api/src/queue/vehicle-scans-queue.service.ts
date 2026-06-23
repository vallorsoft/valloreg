import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  ProcessVehicleScanJobData,
  VEHICLE_SCAN_JOB,
  VEHICLE_SCANS_QUEUE_TOKEN,
} from './queue.constants';

/**
 * Producer: a forgalmi-beolvasás feldolgozó job felvétele a queue-ba.
 * A jobId a scanId-ből képződik, így ugyanaz a beolvasás nem kerül be kétszer
 * (a BullMQ az azonos jobId-t deduplikálja).
 */
@Injectable()
export class VehicleScansQueueService {
  private readonly logger = new Logger(VehicleScansQueueService.name);

  constructor(
    @Inject(VEHICLE_SCANS_QUEUE_TOKEN) private readonly queue: Queue,
  ) {}

  async enqueueProcess(data: ProcessVehicleScanJobData): Promise<void> {
    const jobId = `scan:${data.tenantId}:${data.scanId}`;
    await this.queue.add(VEHICLE_SCAN_JOB.PROCESS, data, { jobId });
    this.logger.log(`Forgalmi-beolvasás sorbavéve (jobId: ${jobId}).`);
  }
}
