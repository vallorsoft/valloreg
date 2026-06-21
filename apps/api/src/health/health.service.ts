import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: {
    db: 'up' | 'down';
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
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    // A DB kötelező; a Redis hiánya csak degraded (a feldolgozó sor leáll, de
    // az API olvasás/írás működik).
    const status: HealthReport['status'] = db === 'up' ? 'ok' : 'degraded';

    return {
      status,
      checks: { db, redis },
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
