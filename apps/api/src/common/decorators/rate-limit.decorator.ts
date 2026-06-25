import { SetMetadata } from '@nestjs/common';

/** Metaadat-kulcs a rate-limit beállításhoz (a RateLimitGuard olvassa). */
export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  /** Megengedett kérések száma az ablakban. */
  limit: number;
  /** Ablak hossza milliszekundumban. */
  windowMs: number;
}

/**
 * Végpont-szintű rate limit (brute-force / enumeráció ellen). Pl. a bejelentkezés
 * és a jelszó-visszaállítás végpontjain. A tényleges számlálást a RateLimitGuard
 * végzi (IP + handler kulccsal).
 */
export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimitOptions);
