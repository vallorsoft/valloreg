import { desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/db';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().min(1).email(),
  name: z.string().min(1).max(255).optional(),
});

/** GET /api/users — list users, newest first. */
export async function GET() {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load users' },
      { status: 500 },
    );
  }
}

/** POST /api/users — create a user. */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [created] = await db.insert(users).values(parsed.data).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    // Most likely a unique-constraint violation on `email`.
    const isConflict = /unique|duplicate/i.test(message);
    return NextResponse.json({ error: message }, { status: isConflict ? 409 : 500 });
  }
}
