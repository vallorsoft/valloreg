import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Example `users` table. Replace/extend with the real domain model — this is
 * here to demonstrate the full Drizzle + Neon round-trip (schema → migration →
 * query).
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
