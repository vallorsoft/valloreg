import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';

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
