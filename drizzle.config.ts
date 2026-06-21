import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// `generate` works offline from the schema; only migrate/push/studio need a
// live URL. Prefer a direct (unpooled) connection for schema changes.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
