import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogInput {
  /** Cégazonosító. Ha nincs, platform-szintű esemény. */
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Audit naplózás. Az AuditLog NEM tenant-scope-olt a Prisma kiterjesztésben
 * (a tenantId opcionális, platform-események is ide kerülnek), ezért a SYSTEM
 * klienst használjuk és a tenantId-t expliciten átadjuk.
 *
 * A naplózás soha nem buktathatja meg az üzleti műveletet: hiba esetén csak logol.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.system.auditLog.create({
        data: {
          tenantId: input.tenantId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          metadata:
            input.metadata === undefined || input.metadata === null
              ? undefined
              : (input.metadata as Prisma.InputJsonValue),
          ip: input.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Audit log írás sikertelen (${input.action}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Audit lista egy tenantnak (ADMIN+). A SYSTEM kliensen fut, de expliciten a
   * megadott tenantId-ra szűr (a hívó controller a request.tenant-ból adja).
   */
  async listForTenant(
    tenantId: string,
    take = 100,
    skip = 0,
  ): Promise<unknown[]> {
    return this.prisma.system.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      // Negatív/túl nagy értékeket lekorlátozunk: a Prisma negatív skip/take-re
      // 500-zal dobna (pl. ?skip=-5 query paraméternél).
      take: Math.max(1, Math.min(take, 500)),
      skip: Math.max(0, skip),
    });
  }
}
