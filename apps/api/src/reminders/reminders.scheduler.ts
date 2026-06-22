import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { RemindersService } from './reminders.service';

const REMINDERS_QUEUE = 'reminders';
const SCAN_JOB = 'scan-reminders';

/**
 * Az emlékeztető-ütemező: napi BullMQ ismétlődő job, amely a worker-ben
 * lefuttatja a `RemindersService.scanAndNotify()`-t (esedékesség-szkennelés +
 * push/email értesítés).
 *
 * A meglévő BullMQ/Redis infrára épül (nincs új függőség). A worker ugyanebben
 * a processzben fut, mint a documents worker. Az ismétlődő job-ot a BullMQ a
 * repeat-kulcs alapján deduplikálja, így újraindításkor nem duplikálódik.
 *
 * Ha nincs Redis, a NestJS bootstrap a meglévő queue modul miatt amúgy is
 * Redist igényel; itt csak ráépülünk.
 */
@Injectable()
export class RemindersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly reminders: RemindersService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = this.config.redis;

    this.queue = new Queue(REMINDERS_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    // Napi futás 07:00-kor (szerver-idő). Ismétlődő job – a repeat-kulcs alapján
    // deduplikálódik, ezért biztonságos minden bootstrapnél meghívni.
    await this.queue.add(
      SCAN_JOB,
      {},
      { repeat: { pattern: '0 7 * * *' }, jobId: 'reminders-daily' },
    );

    this.worker = new Worker(
      REMINDERS_QUEUE,
      async () => {
        const result = await this.reminders.scanAndNotify();
        return result;
      },
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Emlékeztető-szkennelés sikertelen (${job?.id}): ${err.message}`,
        err.stack,
      );
    });

    this.logger.log('Emlékeztető-ütemező elindult (napi szkennelés 07:00).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
