import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DocumentStatus,
  isAllowedDocumentMimeType,
  isWithinLimit,
  PLAN_LIMITS,
  PlanTier,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsQueueService } from '../queue/documents-queue.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { PresignDocumentDto } from './dto/presign-document.dto';
import type { RegisterDocumentDto } from './dto/register-document.dto';

/**
 * Dokumentum műveletek. A Document modell tenant-scope-olt; a worker enqueue-hoz
 * a tenantId-t expliciten átadjuk (a worker nem request-kontextusban fut).
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
    private readonly queue: DocumentsQueueService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Presigned PUT URL kérése. Generál egy documentId-t és tenant-prefixes
   * storageKey-t, és visszaadja a feltöltési URL-t. A kliens a feltöltés után a
   * POST /documents-szel regisztrálja a dokumentumot.
   */
  async presign(tenantId: string, dto: PresignDocumentDto) {
    if (!isAllowedDocumentMimeType(dto.mimeType)) {
      throw AppException.unsupportedDocumentType();
    }

    const documentId = randomUUID();
    const storageKey = this.storage.buildDocumentKey(
      tenantId,
      documentId,
      dto.fileName,
    );
    const uploadUrl = await this.storage.presignPut(storageKey, dto.mimeType);

    return { documentId, storageKey, uploadUrl };
  }

  /**
   * Feltöltött dokumentum regisztrálása:
   *  - MIME + méret validáció,
   *  - havi dokumentum-limit kényszerítése,
   *  - idempotencia a (tenantId, sha256) egyediségre,
   *  - Document(UPLOADED) létrehozás, majd QUEUED + job sorbavétel.
   */
  async register(
    tenantId: string,
    userId: string,
    dto: RegisterDocumentDto,
  ) {
    if (!isAllowedDocumentMimeType(dto.mimeType)) {
      throw AppException.unsupportedDocumentType();
    }
    if (dto.sizeBytes > this.config.maxDocumentSizeBytes) {
      throw AppException.documentTooLarge();
    }

    // Idempotencia: ugyanaz a fájl (sha256) már létezik?
    const existing = await this.prisma.scoped.document.findFirst({
      where: { sha256: dto.sha256 },
    });
    if (existing) {
      return existing;
    }

    await this.assertMonthlyDocumentLimit(tenantId);

    // Létrehozás UPLOADED státusszal, majd QUEUED-re állítás és sorbavétel.
    const document = await this.prisma.scoped.document.create({
      // tenantId-t a scoped kliens is injektálja; explicit a típusbiztonságért.
      data: {
        tenantId,
        uploadedById: userId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: dto.storageKey,
        sha256: dto.sha256,
        status: DocumentStatus.UPLOADED,
      },
    });

    await this.prisma.scoped.document.update({
      where: { id: document.id },
      data: { status: DocumentStatus.QUEUED },
    });

    await this.queue.enqueueProcess({
      tenantId,
      documentId: document.id,
      sha256: document.sha256,
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'document.uploaded',
      resourceType: 'Document',
      resourceId: document.id,
      metadata: { fileName: dto.fileName, sizeBytes: dto.sizeBytes },
    });

    return { ...document, status: DocumentStatus.QUEUED };
  }

  list() {
    return this.prisma.scoped.document.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id },
      include: {
        invoice: { include: { items: true, supplier: true } },
      },
    });
    if (!document) {
      throw AppException.notFound('A dokumentum nem található.');
    }
    return document;
  }

  /** Presigned GET URL a dokumentum letöltéséhez. */
  async getDownloadUrl(id: string): Promise<{ downloadUrl: string }> {
    const document = await this.prisma.scoped.document.findFirst({
      where: { id },
      select: { storageKey: true },
    });
    if (!document) {
      throw AppException.notFound('A dokumentum nem található.');
    }
    const downloadUrl = await this.storage.presignGet(document.storageKey);
    return { downloadUrl };
  }

  /** Havi (naptári hónap) feldolgozott dokumentum-limit ellenőrzése. */
  private async assertMonthlyDocumentLimit(tenantId: string): Promise<void> {
    const subscription = await this.prisma.system.subscription.findUnique({
      where: { tenantId },
      select: { planTier: true },
    });
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limit = PLAN_LIMITS[planTier].maxDocumentsPerMonth;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const count = await this.prisma.scoped.document.count({
      where: { createdAt: { gte: monthStart } },
    });

    if (!isWithinLimit(count, limit)) {
      throw AppException.documentsLimitReached();
    }
  }
}
