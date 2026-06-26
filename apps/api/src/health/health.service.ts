import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import {
  DOCUMENTS_QUEUE,
  VEHICLE_SCANS_QUEUE,
} from '../queue/queue.constants';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: {
    db: 'up' | 'down';
    /**
     * Az adatbázis SÉMA állapota: a migrációk lefutottak-e az élő DB-n.
     *  - 'ready'   : a `users` tábla létezik és lekérdezhető (auth működhet)
     *  - 'missing' : a kapcsolat él, de a tábla hiányzik → migráció nem futott
     *                (ez okozza a login/register 500-at!)
     *  - 'unknown' : a séma nem ellenőrizhető (a DB kapcsolat is hibás)
     */
    schema: 'ready' | 'missing' | 'unknown';
    redis: 'up' | 'down';
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const [db, schema, redis] = await Promise.all([
      this.checkDb(),
      this.checkSchema(),
      this.checkRedis(),
    ]);

    // A DB + séma kötelős az auth-hoz; a Redis hiánya csak degraded (a feldolgozó
    // sor leáll, de az API olvasás/írás működik).
    const status: HealthReport['status'] =
      db === 'up' && schema === 'ready' ? 'ok' : 'degraded';

    return {
      status,
      checks: { db, schema, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.system.$queryRaw`SELECT 1`;
      return 'up';
    } catch (err) {
      this.logger.warn(`DB health check sikertelen: ${(err as Error).message}`);
      return 'down';
    }
  }

  /**
   * A migrációk lefutottak-e: a `users` tábla létezésének ellenőrzése. Ha a
   * kapcsolat él, de a tábla hiányzik (relation does not exist), a séma 'missing'
   * – pontosan ez okozza a login/register 500-at egy hiányos deploynál.
   */
  private async checkSchema(): Promise<'ready' | 'missing' | 'unknown'> {
    try {
      const rows = await this.prisma.system.$queryRaw<
        { exists: boolean }[]
      >`SELECT to_regclass('public.users') IS NOT NULL AS "exists"`;
      return rows[0]?.exists ? 'ready' : 'missing';
    } catch (err) {
      this.logger.warn(
        `Séma health check sikertelen: ${(err as Error).message}`,
      );
      return 'unknown';
    }
  }

  /**
   * Diagnosztika: a BullMQ sorok job-számai. Külön, friss Queue-kapcsolaton
   * (nem a producer példányon) kérdezi le, hogy a health független legyen.
   * A counts kulcsai: waiting, active, completed, failed, delayed, paused.
   */
  async queueStats(): Promise<Record<string, unknown>> {
    const connection = this.config.redis;
    const names = [DOCUMENTS_QUEUE, VEHICLE_SCANS_QUEUE];
    const out: Record<string, unknown> = {};
    await Promise.all(
      names.map(async (name) => {
        const queue = new Queue(name, { connection });
        try {
          out[name] = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'paused',
          );
        } catch (err) {
          out[name] = { error: (err as Error).message };
        } finally {
          await queue.close();
        }
      }),
    );

    // DB-oldal: létrejönnek-e a rekordok és milyen státuszban ragadnak.
    // (Ha a tábla hiányzik, az `error` mező jelzi – pl. vehicle_scans migráció.)
    const [documents, vehicleScans] = await Promise.all([
      this.dbStatusCounts('document'),
      this.dbStatusCounts('vehicleScan'),
    ]);

    return {
      queues: out,
      db: { documents, vehicleScans },
      env: {
        ocrProvider: this.config.ocrProvider,
        extractionProvider: this.config.extractionProvider,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /** Rekord-számok státuszonként egy modellre (system kliens, tenant nélkül). */
  private async dbStatusCounts(
    model: 'document' | 'vehicleScan',
  ): Promise<Record<string, unknown>> {
    try {
      const client = this.prisma.system as unknown as Record<
        string,
        { groupBy: (args: unknown) => Promise<unknown> }
      >;
      const delegate = client[model];
      if (!delegate) return { error: `unknown model ${model}` };
      const rows = (await delegate.groupBy({
        by: ['status'],
        _count: { _all: true },
      })) as Array<{ status: string; _count: { _all: number } }>;
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.status] = r._count._all;
      return counts;
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    const redis = this.config.redis;
    const client = new Redis({
      ...redis,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      client.disconnect();
    }
  }
}
