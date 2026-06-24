import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './env.validation';

/**
 * Tipizált konfiguráció-hozzáférés. Mindenhol ezt injektáljuk a nyers
 * ConfigService helyett, hogy a getterek típusbiztosak legyenek.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  private get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): AppEnv['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get apiPort(): number {
    return this.get('API_PORT');
  }

  /**
   * A tényleges listen port. PaaS (Render/Heroku) a PORT env-et injektálja és
   * azt várja; ha nincs, az API_PORT-ra esünk vissza (helyi fejlesztés).
   */
  get port(): number {
    const fromPaas = process.env.PORT;
    return fromPaas ? Number(fromPaas) : this.apiPort;
  }

  get apiGlobalPrefix(): string {
    return this.get('API_GLOBAL_PREFIX');
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  /**
   * A webes frontend nyilvános URL-je (záró / nélkül). A jelszó-visszaállító
   * e-mail linkje ehhez fűzi a /reset-password útvonalat. Ha a WEB_APP_URL üres,
   * a CORS_ORIGINS első eleme a fallback, végső soron a localhost.
   */
  get webAppUrl(): string {
    const explicit = this.get('WEB_APP_URL').trim();
    const url = explicit || this.corsOrigins[0] || 'http://localhost:3000';
    return url.replace(/\/+$/, '');
  }

  /**
   * KAPCSOLÓ: a frontend same-origin proxyn éri-e el az auth-végpontokat. Ha igen,
   * a refresh cookie first-party → `SameSite=Lax` mehet.
   */
  get sameOriginFrontend(): boolean {
    return this.get('SAME_ORIGIN_FRONTEND');
  }

  /**
   * A refresh token httpOnly cookie beállításai.
   *  - Production + CROSS-SITE (alap): `SameSite=None; Secure` kell, hogy a
   *    böngésző a külön web/api domain közt elküldje.
   *  - Production + SAME-ORIGIN (kapcsoló be): a cookie first-party →
   *    `SameSite=Lax; Secure` (nem érinti a harmadik-fél-cookie korlátozás).
   *  - Helyi fejlesztés (http, azonos site): `Lax`, Secure nélkül.
   * A cookie csak az auth-útvonalakra megy (`/<prefix>/auth`).
   */
  get refreshCookie(): {
    secure: boolean;
    sameSite: 'lax' | 'none';
    path: string;
  } {
    const sameSite: 'lax' | 'none' =
      this.isProduction && !this.sameOriginFrontend ? 'none' : 'lax';
    return {
      secure: this.isProduction,
      sameSite,
      path: `/${this.apiGlobalPrefix}/auth`,
    };
  }

  /** Jelszó-visszaállító token élettartama másodpercben. */
  get passwordResetTtl(): number {
    return this.get('PASSWORD_RESET_TTL');
  }

  /**
   * Redis kapcsolat (BullMQ/ioredis). Ha REDIS_URL adott, abból parse-olunk
   * (rediss:// → TLS); különben a külön host/port/password mezőkből.
   */
  get redis(): {
    host: string;
    port: number;
    password?: string;
    tls?: Record<string, never>;
  } {
    const url = this.get('REDIS_URL');
    if (url) {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        tls: parsed.protocol === 'rediss:' ? {} : undefined,
      };
    }
    const password = this.get('REDIS_PASSWORD');
    return {
      host: this.get('REDIS_HOST'),
      port: this.get('REDIS_PORT'),
      password: password ? password : undefined,
    };
  }

  get jwt(): {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  } {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      accessTtl: this.get('JWT_ACCESS_TTL'),
      refreshTtl: this.get('JWT_REFRESH_TTL'),
    };
  }

  get s3(): {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    forcePathStyle: boolean;
  } {
    // Az accessKey és a region szó szerint bekerül az AWS SigV4 Authorization
    // fejlécbe. Ha az env-érték végén láthatatlan karakter van (pl. Render-re
    // másoláskor becsúszott \n), a Node setHeader ERR_INVALID_CHAR-ral dob.
    return {
      endpoint: this.sanitizeEnv(this.get('S3_ENDPOINT')),
      region: this.sanitizeEnv(this.get('S3_REGION')),
      accessKey: this.sanitizeEnv(this.get('S3_ACCESS_KEY')),
      secretKey: this.sanitizeEnv(this.get('S3_SECRET_KEY')),
      bucket: this.sanitizeEnv(this.get('S3_BUCKET')),
      forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
    };
  }

  private sanitizeEnv(value: string): string {
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
  }

  get ocrProvider(): AppEnv['OCR_PROVIDER'] {
    return this.get('OCR_PROVIDER');
  }

  get extractionProvider(): AppEnv['EXTRACTION_PROVIDER'] {
    return this.get('EXTRACTION_PROVIDER');
  }

  get vehicleVerifyProvider(): AppEnv['VEHICLE_VERIFY_PROVIDER'] {
    return this.get('VEHICLE_VERIFY_PROVIDER');
  }

  /** RO megfelelőség-ellenőrző külső API konfigurációja. */
  get roVerify(): { apiUrl: string; apiKey: string } {
    return {
      apiUrl: this.get('RO_VERIFY_API_URL'),
      apiKey: this.get('RO_VERIFY_API_KEY'),
    };
  }

  /**
   * Gemini konfiguráció. A `models` a feldolgozó modell-lánc: 429 (kvóta) esetén
   * a provider a következő modellre vált. A láncot a GEMINI_MODELS felülírja;
   * a GEMINI_MODEL csak a lánc ELEJÉRE kerül (a többi marad tartaléknak).
   */
  get gemini(): { apiKey: string; models: string[] } {
    // A Google kivezette a gemini-1.5-* modelleket a v1beta generateContent API-ból
    // (404). Csak aktuális, támogatott modellek; a provider 404/429/5xx esetén a
    // következőre vált (mindegyiknek külön ingyenes napi kerete van).
    const DEFAULT_CHAIN = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ];

    const override = this.get('GEMINI_MODELS')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    let models = override.length > 0 ? override : DEFAULT_CHAIN;

    const preferred = this.get('GEMINI_MODEL').trim();
    if (preferred) {
      models = [preferred, ...models.filter((m) => m !== preferred)];
    }

    return { apiKey: this.get('GEMINI_API_KEY'), models };
  }

  get integrationEncKey(): string {
    return this.get('INTEGRATION_ENC_KEY');
  }

  get mail(): { apiKey: string; sender: string; from: string } {
    return {
      apiKey: this.get('BREVO_API_KEY'),
      sender: this.get('BREVO_SENDER'),
      from: this.get('MAIL_FROM'),
    };
  }

  get vapid(): { publicKey: string; privateKey: string; email: string } {
    return {
      publicKey: this.get('VAPID_PUBLIC_KEY'),
      privateKey: this.get('VAPID_PRIVATE_KEY'),
      email: this.get('VAPID_EMAIL'),
    };
  }

  /** Utalásos fizetés banki adatai + a fejlesztői értesítési e-mail. */
  get bankTransfer(): {
    beneficiary: string;
    iban: string;
    bank: string;
    swift: string;
    notifyEmail: string;
  } {
    return {
      beneficiary: this.get('BANK_TRANSFER_BENEFICIARY'),
      iban: this.get('BANK_TRANSFER_IBAN'),
      bank: this.get('BANK_TRANSFER_BANK'),
      swift: this.get('BANK_TRANSFER_SWIFT'),
      notifyEmail: this.get('BILLING_NOTIFY_EMAIL'),
    };
  }

  get maxDocumentSizeBytes(): number {
    return this.get('MAX_DOCUMENT_SIZE_BYTES');
  }
}
