import { Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { DOCUMENTS_QUEUE, DOCUMENTS_QUEUE_TOKEN } from './queue.constants';

/**
 * A `documents` BullMQ Queue (producer oldal) provider-e. A Redis kapcsolatot
 * a configból építi. A retry/backoff alapértelmezést a defaultJobOptions adja:
 * 3 próbálkozás, exponenciális backoff. Tartós hiba esetén a job FAILED marad
 * (removeOnFail:false) – ez a de facto dead-letter (DLQ): a sikertelen jobok
 * megmaradnak a queue 'failed' halmazában, manuálisan/monitorból újrapróbálhatók.
 */
export const documentsQueueProvider: Provider = {
  provide: DOCUMENTS_QUEUE_TOKEN,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): Queue => {
    const redis = config.redis;
    return new Queue(DOCUMENTS_QUEUE, {
      connection: {
        host: redis.host,
        port: redis.port,
        password: redis.password,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        // Hibás jobok megtartása (DLQ-szerű viselkedés monitorozáshoz).
        removeOnFail: false,
      },
    });
  },
};
