import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { CleanupService } from './cleanup.service';

const CLEANUP_QUEUE = 'cleanup';
const PURGE_JOB = 'retention-purge';

/**
 * Retenciós takarító ütemező: napi BullMQ ismétlődő job (03:30), amely a
 * CleanupService.purge()-t futtatja. Ugyanarra a Redis/BullMQ infrára épül, mint
 * a többi ütemező (nincs új függőség), és SOHA nem buktatja meg az API bootját.
 */
@Injectable()
export class CleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly cleanup: CleanupService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const connection = this.config.redis;

      this.queue = new Queue(CLEANUP_QUEUE, {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      });
      this.queue.on('error', (err) =>
        this.logger.warn(`Takarító-queue hiba: ${err.message}`),
      );

      this.worker = new Worker(
        CLEANUP_QUEUE,
        async () => this.cleanup.purge(),
        { connection, concurrency: 1 },
      );
      this.worker.on('error', (err) =>
        this.logger.warn(`Takarító-worker hiba: ${err.message}`),
      );
      this.worker.on('failed', (job, err) => {
        this.logger.error(
          `Retenciós takarítás sikertelen (${job?.id}): ${err.message}`,
          err.stack,
        );
      });

      void this.queue
        .add(PURGE_JOB, {}, { repeat: { pattern: '30 3 * * *' } })
        .catch((err) =>
          this.logger.warn(
            `Napi retenciós takarítás ütemezése később: ${(err as Error).message}`,
          ),
        );

      this.logger.log('Retenciós takarító ütemező elindult (napi 03:30).');
    } catch (err) {
      this.logger.error(
        `A takarító ütemező indítása sikertelen (a boot folytatódik): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
