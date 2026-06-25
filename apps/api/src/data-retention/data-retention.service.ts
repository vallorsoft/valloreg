import { Injectable, Logger } from '@nestjs/common';
import { SupportAccessStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionResult {
  auditLogs: number;
  refreshTokens: number;
  passwordResetTokens: number;
  invitations: number;
  supportAccesses: number;
}

/**
 * Automatikus adat-megőrzési takarítás. Rendszer-szintű (unscoped) törléseket
 * futtat a SYSTEM kliensen: lejárt/feleslegessé vált technikai rekordok.
 * A megőrzési idők env-ből konfigurálhatók (AppConfigService.dataRetention).
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  private threshold(days: number): Date {
    return new Date(Date.now() - days * DAY_MS);
  }

  /** Minden kategória takarítása; visszaadja a törölt rekordszámokat. */
  async runCleanup(): Promise<RetentionResult> {
    const r = this.config.dataRetention;
    const db = this.prisma.system;
    const now = new Date();

    // Audit logok a megőrzési időn túl.
    const auditLogs = await db.auditLog.deleteMany({
      where: { createdAt: { lt: this.threshold(r.auditLogDays) } },
    });

    // Refresh tokenek: lejártak, vagy a megőrzési időn túl visszavontak.
    const refreshTokens = await db.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: this.threshold(r.refreshTokenDays) } },
        ],
      },
    });

    // Jelszó-visszaállító tokenek: lejártak, vagy a megőrzési időn túl használtak.
    const passwordResetTokens = await db.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { lt: this.threshold(r.passwordResetTokenDays) } },
        ],
      },
    });

    // Meghívók: lejártak, vagy a megőrzési időn túl elfogadottak.
    const invitations = await db.invitation.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { acceptedAt: { lt: this.threshold(r.invitationDays) } },
        ],
      },
    });

    // Support hozzáférések: lejártak, vagy a megőrzési időn túl visszavontak.
    const supportAccesses = await db.supportAccess.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          {
            status: {
              in: [SupportAccessStatus.EXPIRED, SupportAccessStatus.REVOKED],
            },
            revokedAt: { lt: this.threshold(r.supportAccessDays) },
          },
        ],
      },
    });

    const result: RetentionResult = {
      auditLogs: auditLogs.count,
      refreshTokens: refreshTokens.count,
      passwordResetTokens: passwordResetTokens.count,
      invitations: invitations.count,
      supportAccesses: supportAccesses.count,
    };

    this.logger.log(
      `Retenciós takarítás: audit=${result.auditLogs}, refresh=${result.refreshTokens}, ` +
        `reset=${result.passwordResetTokens}, invite=${result.invitations}, support=${result.supportAccesses}`,
    );
    return result;
  }
}
