import { Injectable } from '@nestjs/common';
import {
  LEGAL_CATEGORIES,
  legalBlocksSchema,
  legalDocToJson,
  legalDocToMarkdown,
  legalDownloadFilename,
  type LegalBlock,
  type LegalCategory,
  type LegalDocListItem,
  type LegalDocRecord,
  type LegalDownloadFormat,
} from '@valloreg/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailerService } from '../storage/mailer.service';
import { AppException } from '../common/exceptions/app.exception';
import { legalDocToPdf } from './legal-pdf';
import type { UpdateLegalDocDto } from './dto/update-legal-doc.dto';

/** Egy letölthető fájl (név + MIME + tartalom). */
export interface LegalDownload {
  filename: string;
  contentType: string;
  body: Buffer;
}

type LegalRow = {
  slug: string;
  category: string;
  title: string;
  subtitle: string | null;
  summary: string;
  updatedLabel: string;
  blocks: Prisma.JsonValue;
  isPublic: boolean;
  updatedAt: Date;
};

const CONTENT_TYPES: Record<LegalDownloadFormat, string> = {
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  pdf: 'application/pdf',
};

/**
 * Jogi / GDPR dokumentumok (GLOBÁLIS modell → SYSTEM kliens, nincs tenant
 * kontextus). Publikus olvasás + SuperAdmin műveletek (szerkesztés, publikálás,
 * letöltés, cégnek küldés). Minden írás auditálva.
 */
@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
  ) {}

  // ── Publikus (auth nélkül) ────────────────────────────────────────────────

  /** A publikus dokumentumok kategóriánként (lista-elemek, blokkok nélkül). */
  async listPublic() {
    const docs = await this.prisma.system.legalDocument.findMany({
      where: { isPublic: true },
      orderBy: { category: 'asc' },
    });
    const items = docs.map((d) => this.toListItem(d));
    return {
      categories: LEGAL_CATEGORIES.map((cat) => ({
        ...cat,
        docs: items.filter((d) => d.category === cat.key),
      })).filter((cat) => cat.docs.length > 0),
    };
  }

  /** Egy publikus dokumentum (csak ha isPublic). */
  async getPublic(slug: string): Promise<LegalDocRecord> {
    const row = await this.prisma.system.legalDocument.findUnique({
      where: { slug },
    });
    if (!row || !row.isPublic) {
      throw AppException.notFound('A dokumentum nem található.');
    }
    return this.toRecord(row);
  }

  // ── SuperAdmin ────────────────────────────────────────────────────────────

  /** Minden dokumentum (publikus + belső), lista-elemként. */
  async listAll(): Promise<LegalDocListItem[]> {
    const docs = await this.prisma.system.legalDocument.findMany({
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return docs.map((d) => this.toListItem(d));
  }

  /** Egy dokumentum teljes tartalma (admin – akkor is, ha nem publikus). */
  async getOne(slug: string): Promise<LegalDocRecord> {
    const row = await this.requireRow(slug);
    return this.toRecord(row);
  }

  /** Tartalom szerkesztése. A blokkokat a megosztott zod-sémával validálja. */
  async update(actorUserId: string, slug: string, dto: UpdateLegalDocDto): Promise<LegalDocRecord> {
    await this.requireRow(slug);

    const parsed = legalBlocksSchema.safeParse(dto.blocks);
    if (!parsed.success) {
      throw AppException.validation('Érvénytelen dokumentum-blokkok.');
    }

    const updated = await this.prisma.system.legalDocument.update({
      where: { slug },
      data: {
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        summary: dto.summary,
        updatedLabel: dto.updated,
        blocks: parsed.data as unknown as Prisma.InputJsonValue,
        updatedById: actorUserId,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'admin.legal_doc_updated',
      resourceType: 'LegalDocument',
      resourceId: slug,
    });

    return this.toRecord(updated);
  }

  /** Publikus láthatóság kapcsolása (közzététel / visszavonás). */
  async setVisibility(
    actorUserId: string,
    slug: string,
    isPublic: boolean,
  ): Promise<LegalDocRecord> {
    await this.requireRow(slug);

    const updated = await this.prisma.system.legalDocument.update({
      where: { slug },
      data: { isPublic, updatedById: actorUserId },
    });

    await this.audit.log({
      userId: actorUserId,
      action: isPublic ? 'admin.legal_doc_published' : 'admin.legal_doc_unpublished',
      resourceType: 'LegalDocument',
      resourceId: slug,
      metadata: { isPublic },
    });

    return this.toRecord(updated);
  }

  /** Egy dokumentum letöltése a kért formátumban (md / json / pdf). */
  async download(slug: string, format: LegalDownloadFormat): Promise<LegalDownload> {
    const row = await this.requireRow(slug);
    const record = this.toRecord(row);
    return {
      filename: legalDownloadFilename(slug, format),
      contentType: CONTENT_TYPES[format],
      body: await this.serialize(record, format),
    };
  }

  /**
   * Egy dokumentum elküldése egy cégnek (tenant) e-mailben, CSATOLT fájlként.
   * A cég kapcsolattartói e-mailjére megy; audit-logba kerül.
   */
  async sendToTenant(
    actorUserId: string,
    slug: string,
    tenantId: string,
    format: LegalDownloadFormat,
  ) {
    const row = await this.requireRow(slug);
    const record = this.toRecord(row);

    const tenant = await this.prisma.system.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, email: true },
    });
    if (!tenant) throw AppException.notFound('A cég nem található.');
    if (!tenant.email) {
      throw AppException.validation('A cégnek nincs kapcsolattartói e-mail címe.');
    }

    const body = await this.serialize(record, format);
    const filename = legalDownloadFilename(slug, format);

    const result = await this.mailer.send({
      to: tenant.email,
      subject: `Valloreg – document legal: ${record.title}`,
      text:
        `Bună ziua,\n\nVă transmitem documentul „${record.title}" (Valloreg), ` +
        `atașat acestui e-mail (${filename}).\n\nO zi bună,\nEchipa Valloreg`,
      attachments: [{ name: filename, contentBase64: body.toString('base64') }],
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'admin.legal_doc_sent',
      resourceType: 'LegalDocument',
      resourceId: slug,
      metadata: { tenantId, format, ok: result.ok, status: result.status ?? null },
    });

    return { ok: result.ok, status: result.status ?? null, to: tenant.email };
  }

  // ── Belső segédek ─────────────────────────────────────────────────────────

  private async serialize(record: LegalDocRecord, format: LegalDownloadFormat): Promise<Buffer> {
    switch (format) {
      case 'md':
        return Buffer.from(legalDocToMarkdown(record), 'utf-8');
      case 'json':
        return Buffer.from(legalDocToJson(record), 'utf-8');
      case 'pdf':
        return legalDocToPdf(record);
      default:
        throw AppException.validation('Ismeretlen letöltési formátum.');
    }
  }

  private async requireRow(slug: string): Promise<LegalRow> {
    const row = await this.prisma.system.legalDocument.findUnique({
      where: { slug },
    });
    if (!row) throw AppException.notFound('A dokumentum nem található.');
    return row;
  }

  private toRecord(row: LegalRow): LegalDocRecord {
    return {
      slug: row.slug,
      category: row.category as LegalCategory,
      title: row.title,
      subtitle: row.subtitle,
      summary: row.summary,
      updated: row.updatedLabel,
      blocks: (row.blocks as unknown as LegalBlock[]) ?? [],
      isPublic: row.isPublic,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toListItem(row: LegalRow): LegalDocListItem {
    return {
      slug: row.slug,
      category: row.category as LegalCategory,
      title: row.title,
      subtitle: row.subtitle,
      summary: row.summary,
      updated: row.updatedLabel,
      isPublic: row.isPublic,
    };
  }
}
