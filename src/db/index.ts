import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

import { getEnv } from '@/env';
import * as schema from '@/db/schema';

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Lazily creates (and caches) the Drizzle client backed by Neon's serverless
 * HTTP driver. Lazy init keeps module import side-effect free, so build-time
 * tooling never needs a live `DATABASE_URL`.
 */
function getDb(): Database {
  if (!instance) {
    const sql = neon(getEnv().DATABASE_URL);
    instance = drizzle(sql, { schema });
  }
  return instance;
}

/**
 * Drizzle database client. Backed by a lazy proxy so the underlying connection
 * is only created the first time a query method is actually used.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
