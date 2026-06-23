import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DeleteObjectCommand,
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
      // Az AWS SDK v3.729+ alapból CRC32 checksumot számol (WHEN_SUPPORTED), ami a
      // presigned URL-be `x-amz-checksum-crc32` + `x-amz-sdk-checksum-algorithm`
      // ALÁÍRT query paramétereket tesz. A böngésző egyszerű PUT-ja ezeket nem tudja
      // teljesíteni, így az R2/S3/MinIO 4xx-szel elutasítja a feltöltést. WHEN_REQUIRED
      // mellett a checksum csak akkor kerül be, ha expliciten kérjük – így a presigned
      // PUT a böngészőből újra működik.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
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

  /**
   * Szerveroldali feltöltés az objektumtárba. A böngésző a fájlt az API-nak
   * küldi (multipart), az API pedig innen tölti fel – így nincs szükség
   * böngésző→S3 CORS-ra, presigned URL-re vagy kliensoldali checksumra.
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
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

  /** Objektum törlése a tárból. Idempotens: nem létező kulcs nem hiba (S3). */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
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
