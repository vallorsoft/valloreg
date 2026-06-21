import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AppException } from '../common/exceptions/app.exception';
import type { SubscribePushDto } from './dto/subscribe-push.dto';

/** Egy push értesítés tartalma (a service worker ezt jeleníti meg). */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Web Push (VAPID) értesítések. A feliratkozásokat a `push_subscriptions`
 * táblában tároljuk (GLOBÁLIS, user-höz kötött), ezért a SYSTEM klienst
 * használjuk explicit userId/tenantId szűréssel.
 *
 * Ha nincs VAPID kulcs beállítva, a szolgáltatás NEM dob – csak logol és kihagy
 * (mint a MailerService), hogy az üzleti műveletek ne bukjanak meg.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    const { publicKey, privateKey, email } = this.config.vapid;
    if (publicKey && privateKey) {
      webpush.setVapidDetails(
        email || 'mailto:admin@valloreg.local',
        publicKey,
        privateKey,
      );
      this.enabled = true;
      this.logger.log('Web Push engedélyezve (VAPID beállítva).');
    } else {
      this.logger.warn(
        'VAPID kulcs hiányzik – a push értesítés ki van kapcsolva.',
      );
    }
  }

  /** A publikus VAPID kulcs (a kliens ezzel iratkozik fel). */
  getPublicKey(): { publicKey: string; enabled: boolean } {
    return { publicKey: this.config.vapid.publicKey, enabled: this.enabled };
  }

  /** Feliratkozás létrehozása/frissítése az endpoint alapján. */
  async subscribe(
    userId: string,
    tenantId: string | null,
    dto: SubscribePushDto,
  ): Promise<{ ok: true }> {
    const p256dh = dto.keys?.p256dh;
    const auth = dto.keys?.auth;
    if (!p256dh || !auth) {
      throw AppException.validation('Hiányzó push kulcsok (p256dh/auth).');
    }

    await this.prisma.system.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        tenantId,
        endpoint: dto.endpoint,
        p256dh,
        auth,
        userAgent: dto.userAgent ?? null,
      },
      update: {
        userId,
        tenantId,
        p256dh,
        auth,
        userAgent: dto.userAgent ?? null,
      },
    });
    return { ok: true };
  }

  /** Leiratkozás endpoint alapján. */
  async unsubscribe(endpoint: string): Promise<{ ok: true }> {
    await this.prisma.system.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  /** Értesítés egy felhasználó minden eszközére. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.prisma.system.pushSubscription.findMany({
      where: { userId },
    });
    await this.deliver(subs, payload);
  }

  /** Értesítés egy cég minden feliratkozott eszközére. */
  async sendToTenant(tenantId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.prisma.system.pushSubscription.findMany({
      where: { tenantId },
    });
    await this.deliver(subs, payload);
  }

  private async deliver(
    subs: { endpoint: string; p256dh: string; auth: string }[],
    payload: PushPayload,
  ): Promise<void> {
    if (subs.length === 0) return;
    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404/410 = lejárt vagy visszavont feliratkozás → takarítás.
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.system.pushSubscription.deleteMany({
              where: { endpoint: sub.endpoint },
            });
          } else {
            this.logger.warn(
              `Push küldés sikertelen: ${(err as Error).message}`,
            );
          }
        }
      }),
    );
  }
}
