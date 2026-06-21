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

  get apiGlobalPrefix(): string {
    return this.get('API_GLOBAL_PREFIX');
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get redis(): { host: string; port: number; password?: string } {
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
    return {
      endpoint: this.get('S3_ENDPOINT'),
      region: this.get('S3_REGION'),
      accessKey: this.get('S3_ACCESS_KEY'),
      secretKey: this.get('S3_SECRET_KEY'),
      bucket: this.get('S3_BUCKET'),
      forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
    };
  }

  get ocrProvider(): AppEnv['OCR_PROVIDER'] {
    return this.get('OCR_PROVIDER');
  }

  get extractionProvider(): AppEnv['EXTRACTION_PROVIDER'] {
    return this.get('EXTRACTION_PROVIDER');
  }

  /**
   * Gemini konfiguráció. A `models` a feldolgozó modell-lánc: 429 (kvóta) esetén
   * a provider a következő modellre vált. A láncot a GEMINI_MODELS felülírja;
   * a GEMINI_MODEL csak a lánc ELEJÉRE kerül (a többi marad tartaléknak).
   */
  get gemini(): { apiKey: string; models: string[] } {
    const DEFAULT_CHAIN = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
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

  get maxDocumentSizeBytes(): number {
    return this.get('MAX_DOCUMENT_SIZE_BYTES');
  }
}
