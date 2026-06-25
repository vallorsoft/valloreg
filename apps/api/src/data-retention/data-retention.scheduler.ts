import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { DataRetentionService } from './data-retention.service';

const RETENTION_QUEUE = 'data-retention';
const CLEANUP_JOB = 'cleanup';

/**
 * Napi BullMQ ismétlődő job, amely lefuttatja a retenciós takarítást
 * (DataRetentionService.runCleanup). A RemindersScheduler mintáját követi:
 * a háttér-ütemező SOHA nem buktathatja meg az API bootját (fail-safe).
 */
@Injectable()
export class DataRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataRetentionScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly retention: DataRetentionService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const connection = this.config.redis;

      this.queue = new Queue(RETENTION_QUEUE, {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 30,
          removeOnFail: 30,
        },
      });
      this.queue.on('error', (err) =>
        this.logger.warn(`Retenciós-queue hiba: ${err.message}`),
      );

      this.worker = new Worker(
        RETENTION_QUEUE,
        async () => this.retention.runCleanup(),
        { connection, concurrency: 1 },
      );
      this.worker.on('error', (err) =>
        this.logger.warn(`Retenciós-worker hiba: ${err.message}`),
      );
      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Retenciós takarítás sikertelen (${job?.id}): ${err.message}`,
          err.stack,
        );
      });

      // Napi futás 03:00-kor (off-peak). A repeat-kulcs deduplikál.
      void this.queue
        .add(CLEANUP_JOB, {}, { repeat: { pattern: '0 3 * * *' } })
        .catch((err) =>
          this.logger.warn(
            `Napi retenciós takarítás ütemezése később: ${(err as Error).message}`,
          ),
        );

      this.logger.log('Retenciós-ütemező elindult (napi takarítás 03:00).');
    } catch (err) {
      this.logger.error(
        `A retenciós-ütemező indítása sikertelen (a boot folytatódik): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
