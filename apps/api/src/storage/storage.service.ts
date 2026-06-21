import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '../config/app-config.service';
import type { Readable } from 'node:stream';

/**
 * S3 / MinIO objektumtár wrapper. Presigned PUT/GET URL-eket ad, és felépíti a
 * tenant-prefixes tárolási kulcsot.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  /** Presigned URL érvényesség (másodperc). */
  private readonly urlExpirySeconds = 15 * 60;

  constructor(private readonly config: AppConfigService) {
    const s3 = this.config.s3;
    this.bucket = s3.bucket;
    this.client = new S3Client({
      endpoint: s3.endpoint,
      region: s3.region,
      forcePathStyle: s3.forcePathStyle,
      credentials: {
        accessKeyId: s3.accessKey,
        secretAccessKey: s3.secretKey,
      },
    });
  }

  onModuleInit(): void {
    this.logger.log(
      `Storage konfigurálva (bucket: ${this.bucket}, endpoint: ${this.config.s3.endpoint}).`,
    );
  }

  /**
   * Tárolási kulcs felépítése: tenants/{tenantId}/documents/{documentId}/{fileName}
   * A fájlnevet biztonságosra normalizáljuk (path traversal ellen).
   */
  buildDocumentKey(
    tenantId: string,
    documentId: string,
    fileName: string,
  ): string {
    const safeName = this.sanitizeFileName(fileName);
    return `tenants/${tenantId}/documents/${documentId}/${safeName}`;
  }

  /** Presigned PUT URL feltöltéshez. */
  async presignPut(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: this.urlExpirySeconds,
    });
  }

  /** Fájl letöltése bufferbe (OCR provider-ek számára). */
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(command);
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /** Presigned GET URL letöltéshez. */
  async presignGet(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: this.urlExpirySeconds,
    });
  }

  private sanitizeFileName(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() ?? 'file';
    // Csak alfanumerikus + pont/kötőjel/aláhúzás; egyébként aláhúzás.
    const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_');
    return cleaned.length > 0 ? cleaned : 'file';
  }
}
