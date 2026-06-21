import { desc } from 'drizzle-orm';

import { db } from '@/db';
import { users, type User } from '@/db/schema';

// Always render at request time — this page reads from the database.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let rows: User[] = [];
  let dbError: string | null = null;

  try {
    rows = await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Unknown database error';
  }

  return (
    <main>
      <h1>valloreg</h1>
      <p className="subtitle">Next.js + Drizzle ORM + Neon Postgres</p>

      {dbError ? (
        <div className="card error">
          <strong>Database not reachable</strong>
          <span>{dbError}</span>
          <p style={{ marginTop: '0.75rem' }}>
            Set <code>DATABASE_URL</code> in <code>.env</code>, then run{' '}
            <code>npm run db:migrate</code>.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="empty">
          No users yet. Create one via <code>POST /api/users</code> or run{' '}
          <code>npm run db:seed</code>.
        </p>
      ) : (
        rows.map((user) => (
          <div className="card" key={user.id}>
            <strong>{user.name ?? '(no name)'}</strong>
            <span>{user.email}</span>
          </div>
        ))
      )}
    </main>
  );
}
