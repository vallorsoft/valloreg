import type { CookieOptions, Request, Response } from 'express';

/**
 * A refresh token httpOnly cookie kezelése. A refresh token SOHA nem kerül a
 * JS számára elérhető tárba (localStorage) – csak ebben a httpOnly cookie-ban
 * él, így XSS esetén sem olvasható ki.
 *
 * Olvasáshoz nincs cookie-parser függőség: a nyers `Cookie` fejlécet bontjuk.
 */

export const REFRESH_COOKIE = 'valloreg_rt';

/** A cookie környezetfüggő beállításai (lásd AppConfigService.refreshCookie). */
export interface RefreshCookieConfig {
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
}

function buildOptions(
  cfg: RefreshCookieConfig,
  maxAgeMs?: number,
): CookieOptions {
  return {
    httpOnly: true,
    secure: cfg.secure,
    sameSite: cfg.sameSite,
    path: cfg.path,
    // maxAge nélkül a cookie SESSION cookie (a böngésző bezárásakor törlődik) –
    // ez a "Remember me" nélküli eset.
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

/**
 * A refresh cookie beállítása. `maxAgeMs` megadva → tartós cookie ("Remember me"),
 * elhagyva → session cookie.
 */
export function setRefreshCookie(
  res: Response,
  token: string,
  cfg: RefreshCookieConfig,
  maxAgeMs?: number,
): void {
  res.cookie(REFRESH_COOKIE, token, buildOptions(cfg, maxAgeMs));
}

/** A refresh cookie törlése (kijelentkezés). Ugyanazokkal az attribútumokkal. */
export function clearRefreshCookie(
  res: Response,
  cfg: RefreshCookieConfig,
): void {
  res.clearCookie(REFRESH_COOKIE, buildOptions(cfg));
}

/** A refresh token kiolvasása a nyers Cookie fejlécből (null, ha nincs). */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === REFRESH_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
