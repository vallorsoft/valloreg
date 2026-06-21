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

  get anthropicModel(): string {
    return this.get('ANTHROPIC_MODEL');
  }

  get anthropicApiKey(): string {
    return this.get('ANTHROPIC_API_KEY');
  }

  get smtp(): {
    host: string;
    port: number;
    user?: string;
    password?: string;
    from: string;
  } {
    const user = this.get('SMTP_USER');
    const password = this.get('SMTP_PASSWORD');
    return {
      host: this.get('SMTP_HOST'),
      port: this.get('SMTP_PORT'),
      user: user ? user : undefined,
      password: password ? password : undefined,
      from: this.get('SMTP_FROM'),
    };
  }

  get maxDocumentSizeBytes(): number {
    return this.get('MAX_DOCUMENT_SIZE_BYTES');
  }
}
