import { NextResponse } from 'next/server';

/**
 * Web egészség-végpont a keep-alive / uptime pinghez.
 *
 * Miért kell: a gyökér `/` a nyelvi (next-intl) middleware miatt ÁTIRÁNYÍT
 * (`/` → `/hu`), tehát 307-et ad, nem 200-at – a legtöbb pinger 200-at vár. Ez a
 * végpont a `/api/*` alatt van, amit a middleware matcher KIZÁR, így nincs
 * redirect, és tiszta 200-at ad.
 *
 * Megjegyzés (Render free kvóta): a web 24/7 ébren tartása a 750 instance-óra/hó
 * keretbe ütközhet (az API már önmagában ~730 órát fogyaszt). Ezt a végpontot
 * tehát megfontoltan pingeld (pl. csak munkaidőben), vagy fizetős csomaggal.
 */

// Ne statikus prerenderből szolgáljuk ki: minden kérés a futó szervert érje.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok', service: 'valloreg-web' });
}
