import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { BenchmarkService } from './benchmark.service';

const BENCHMARK_QUEUE = 'benchmark';
const RECOMPUTE_JOB = 'recompute-benchmark';

/**
 * Heti flotta-benchmark újraszámítás. BullMQ ismétlődő job, boot-biztos init
 * (a háttér-ütemező SOHA nem buktathatja meg az API bootját). A meglévő
 * reminders/verification scheduler mintáját követi.
 */
@Injectable()
export class BenchmarkScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BenchmarkScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly benchmark: BenchmarkService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.schedulerEnabled) {
      this.logger.log(
        'Ütemező kikapcsolva (SCHEDULER_ENABLED=false) – nincs worker/job ezen az instance-on.',
      );
      return;
    }
    try {
      const connection = this.config.redis;

      this.queue = new Queue(BENCHMARK_QUEUE, {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      });
      this.queue.on('error', (err) =>
        this.logger.warn(`Benchmark-queue hiba: ${err.message}`),
      );

      this.worker = new Worker(
        BENCHMARK_QUEUE,
        async () => this.benchmark.recompute(),
        { connection, concurrency: 1 },
      );
      this.worker.on('error', (err) =>
        this.logger.warn(`Benchmark-worker hiba: ${err.message}`),
      );
      this.worker.on('failed', (job, err) =>
        this.logger.error(
          `Benchmark-számítás sikertelen (${job?.id}): ${err.message}`,
          err.stack,
        ),
      );

      // Hetente vasárnap 03:00 – fire-and-forget, nem blokkolja a bootot.
      void this.queue
        .add(RECOMPUTE_JOB, {}, { repeat: { pattern: '0 3 * * 0' } })
        .catch((err) =>
          this.logger.warn(
            `Benchmark-számítás ütemezése később: ${(err as Error).message}`,
          ),
        );

      this.logger.log('Benchmark-ütemező elindult (vasárnap 03:00).');
    } catch (err) {
      this.logger.error(
        `A benchmark-ütemező indítása sikertelen (a boot folytatódik): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
