import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { VerificationService } from './verification.service';

const VERIFY_QUEUE = 'verification';
const SCAN_JOB = 'verify-ro';

/**
 * Heti RO megfelelőség-ellenőrzés (ITP/RCA/rovinietă). BullMQ ismétlődő job,
 * boot-biztos init (a háttér-ütemező soha nem buktathatja meg az API bootját).
 */
@Injectable()
export class VerificationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VerificationScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly verification: VerificationService,
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

      this.queue = new Queue(VERIFY_QUEUE, {
        connection,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      });
      this.queue.on('error', (err) =>
        this.logger.warn(`Verification-queue hiba: ${err.message}`),
      );

      this.worker = new Worker(
        VERIFY_QUEUE,
        async () => this.verification.verifyAllRo(),
        { connection, concurrency: 1 },
      );
      this.worker.on('error', (err) =>
        this.logger.warn(`Verification-worker hiba: ${err.message}`),
      );
      this.worker.on('failed', (job, err) =>
        this.logger.error(
          `RO ellenőrzés sikertelen (${job?.id}): ${err.message}`,
          err.stack,
        ),
      );

      // Hetente hétfőn 06:00 – fire-and-forget, nem blokkolja a bootot.
      void this.queue
        .add(SCAN_JOB, {}, { repeat: { pattern: '0 6 * * 1' } })
        .catch((err) =>
          this.logger.warn(
            `RO ellenőrzés ütemezése később: ${(err as Error).message}`,
          ),
        );

      this.logger.log('RO megfelelőség-ütemező elindult (hétfő 06:00).');
    } catch (err) {
      this.logger.error(
        `A RO megfelelőség-ütemező indítása sikertelen (a boot folytatódik): ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
