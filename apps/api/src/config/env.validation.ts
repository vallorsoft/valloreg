import { z } from 'zod';

/**
 * Környezeti változók séma + parse. A ConfigModule indításkor validál;
 * hiányzó/hibás kötelező változónál az app NEM indul el (fail-fast).
 */

/**
 * Boolean env-változó parse: "true"/"1" → true, minden más → false.
 * Hiányzó értéknél a megadott alapértelmezést használja.
 */
function booleanString(defaultValue: boolean) {
  return z
    .preprocess((v) => {
      if (v === undefined) return defaultValue;
      if (typeof v === 'boolean') return v;
      return v === 'true' || v === '1';
    }, z.boolean())
    .default(defaultValue);
}

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // API
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_GLOBAL_PREFIX: z.string().default('api'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // PostgreSQL – a DIRECT_URL opcionális (Neon-nál külön); ha nincs, a
  // PrismaService a DATABASE_URL-t használja a migrációkhoz is.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL kötelező'),
  DIRECT_URL: z.string().optional(),

  // Redis / BullMQ. Ha REDIS_URL meg van adva (pl. Render Key Value
  // connection string: redis:// vagy rediss://), az elsőbbséget élvez a
  // külön host/port/password fölött.
  REDIS_URL: z.string().optional().default(''),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET kötelező'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET kötelező'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),

  // S3 / MinIO
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY: z.string().default('valloreg'),
  S3_SECRET_KEY: z.string().default('valloreg-secret'),
  S3_BUCKET: z.string().default('valloreg-documents'),
  S3_FORCE_PATH_STYLE: booleanString(true),

  // Integrációs kulcsok titkosítása (opcionális; ha üres, nincs titkosítás)
  INTEGRATION_ENC_KEY: z.string().optional().default(''),

  // OCR provider (Fázis 2). Gemini vision olvassa a fájlt; mistral/google opció.
  OCR_PROVIDER: z.enum(['stub', 'gemini', 'mistral', 'google']).default('stub'),
  MISTRAL_API_KEY: z.string().optional().default(''),
  GOOGLE_DOCUMENT_AI_PROJECT_ID: z.string().optional().default(''),
  GOOGLE_DOCUMENT_AI_LOCATION: z.string().optional().default('eu'),
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID: z.string().optional().default(''),

  // Extraction provider (Fázis 2): Google Gemini (vision = OCR + extraction).
  EXTRACTION_PROVIDER: z.enum(['stub', 'gemini']).default('stub'),
  GEMINI_API_KEY: z.string().optional().default(''),
  // Opcionális: ha megadod, EZ kerül a modell-lánc elejére.
  GEMINI_MODEL: z.string().optional().default(''),
  // Opcionális: a TELJES modell-láncot felülírja (vesszős lista).
  GEMINI_MODELS: z.string().optional().default(''),

  // E-mail: Brevo (transactional API). Ha nincs kulcs, a mailer csak logol.
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_SENDER: z.string().default('noreply@valloreg.local'),
  MAIL_FROM: z.string().default('noreply@valloreg.local'),

  // Web Push (VAPID) – Fázis 4 push értesítések.
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_EMAIL: z.string().default('mailto:admin@valloreg.local'),

  // Utalásos fizetés – a fejlesztő/üzemeltető bankszámla adatai. Ezeket a
  // kliens megkapja előfizetéskor; a BILLING_NOTIFY_EMAIL kapja az értesítést.
  BANK_TRANSFER_BENEFICIARY: z.string().optional().default(''),
  BANK_TRANSFER_IBAN: z.string().optional().default(''),
  BANK_TRANSFER_BANK: z.string().optional().default(''),
  BANK_TRANSFER_SWIFT: z.string().optional().default(''),
  BILLING_NOTIFY_EMAIL: z.string().optional().default(''),

  // Feldolgozási limit
  MAX_DOCUMENT_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * ConfigModule `validate` hook. Hibánál olvasható üzenettel dob.
 */
export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Hibás környezeti konfiguráció:\n${issues}`);
  }
  return parsed.data;
}
