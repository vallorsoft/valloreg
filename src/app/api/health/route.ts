import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';

export const dynamic = 'force-dynamic';

/** Liveness/readiness probe that also verifies database connectivity. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'down',
        message: error instanceof Error ? error.message : 'Unknown database error',
      },
      { status: 503 },
    );
  }
}
