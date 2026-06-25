import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Egyszerű, FÜGGŐSÉG NÉLKÜLI, memóriában tartott rate limiter (fixed window).
 * A @RateLimit(limit, windowMs)-szel jelölt végpontokra hat, IP + handler
 * kulccsal. Brute-force / enumeráció ellen véd (pl. login, forgot/reset password).
 *
 * Korlát: a számláló per-process. A jelenlegi telepítés (Render, 1 instance)
 * mellett ez elegendő; több instance esetén Redis-alapú számlálóra kell váltani.
 * A bejegyzéseket lusta ürítéssel (lejárt bucketek törlése) tartjuk kordában.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Csak a kifejezetten jelölt végpontok korlátozottak.
    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.clientIp(req);
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `${ip}:${handler}`;
    const now = Date.now();

    this.maybeSweep(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (bucket.count >= options.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw new HttpException(
        `Túl sok kérés. Próbáld újra ${retryAfter} másodperc múlva.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }

  private clientIp(req: Request): string {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /** Lejárt bucketek lusta ürítése (legfeljebb percenként), hogy ne nőjön a Map. */
  private maybeSweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
