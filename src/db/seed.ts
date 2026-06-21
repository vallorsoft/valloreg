import 'dotenv/config';

import { db } from '@/db';
import { users, type NewUser } from '@/db/schema';

const seedUsers: NewUser[] = [
  { email: 'admin@valloreg.dev', name: 'Admin' },
  { email: 'demo@valloreg.dev', name: 'Demo User' },
];

async function main() {
  console.log('🌱 Seeding database…');
  const inserted = await db.insert(users).values(seedUsers).onConflictDoNothing().returning();
  console.log(`✅ Done. Inserted ${inserted.length} new user(s).`);
}

main().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
