import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Retenciós napok (env-felülírható, ésszerű alapértékekkel). */
function days(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Adatretenciós takarítás (GDPR art. 5(1)(e) – tárolás korlátozása).
 *
 * SYSTEM klienssel fut (platform-szintű karbantartás). Idempotens: csak a
 * retenciós ablakon túli, már nem szükséges rekordokat törli. A küszöbök
 * env-ből felülírhatók; az alapértékek konzervatívak.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purge(): Promise<{
    auditLogs: number;
    refreshTokens: number;
    passwordResetTokens: number;
    vehicleScans: number;
  }> {
    const now = Date.now();
    const auditCutoff = new Date(now - days('AUDIT_RETENTION_DAYS', 365) * DAY_MS);
    const refreshCutoff = new Date(
      now - days('REFRESH_TOKEN_RETENTION_DAYS', 30) * DAY_MS,
    );
    const resetCutoff = new Date(
      now - days('RESET_TOKEN_RETENTION_DAYS', 1) * DAY_MS,
    );
    const scanCutoff = new Date(now - days('SCAN_STAGING_RETENTION_DAYS', 7) * DAY_MS);

    // Audit naplók (IP-vel) – a retenciós ablakon túl.
    const auditLogs = await this.prisma.system.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });

    // Visszavont VAGY lejárt refresh tokenek – a megőrzési ablakon túl.
    const refreshTokens = await this.prisma.system.refreshToken.deleteMany({
      where: {
        OR: [
          { revokedAt: { lt: refreshCutoff } },
          { expiresAt: { lt: refreshCutoff } },
        ],
      },
    });

    // Lejárt jelszó-visszaállító tokenek (egyszer használatos, rövid életű).
    const passwordResetTokens =
      await this.prisma.system.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: resetCutoff } },
      });

    // Beragadt/hibás forgalmi-scan staging rekordok (DONE-okat megtartjuk).
    const vehicleScans = await this.prisma.system.vehicleScan.deleteMany({
      where: {
        status: { in: ['FAILED', 'PENDING'] },
        createdAt: { lt: scanCutoff },
      },
    });

    const result = {
      auditLogs: auditLogs.count,
      refreshTokens: refreshTokens.count,
      passwordResetTokens: passwordResetTokens.count,
      vehicleScans: vehicleScans.count,
    };
    this.logger.log(
      `Retenciós takarítás kész: audit=${result.auditLogs}, refresh=${result.refreshTokens}, reset=${result.passwordResetTokens}, scan=${result.vehicleScans}.`,
    );
    return result;
  }
}
