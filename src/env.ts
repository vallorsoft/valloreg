import { z } from 'zod';

/**
 * Server-side environment schema. Validated lazily (on first access) so that
 * `next build` and tooling that only imports modules for their metadata never
 * require a live configuration.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      'DATABASE_URL must be a Postgres connection string (postgres://… or postgresql://…)',
    ),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Returns the validated environment, throwing a readable error if anything is
 * missing or malformed. The result is memoised after the first successful read.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  cached = parsed.data;
  return cached;
}
