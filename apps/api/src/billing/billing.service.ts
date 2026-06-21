import { Injectable } from '@nestjs/common';
import {
  PLAN_CURRENCY,
  PLAN_LIMITS,
  PLAN_PRICES,
  PlanTier,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { MailerService } from '../storage/mailer.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestSubscriptionDto } from './dto/request-subscription.dto';

/**
 * Előfizetés-áttekintés és utalásos előfizetés-igénylés.
 *
 * Fizetés: NINCS bankkártya (Stripe) – a kliens BANKI UTALÁSSAL fizet. Igényléskor
 * a kliens e-mailben megkapja az utalási adatokat (a fejlesztő bankszámláját,
 * az összeget és a közlemény-azonosítót), a fejlesztő pedig értesítést kap, hogy
 * várja az utalást. A tényleges aktiválást (csomag + ACTIVE) a Super Admin végzi,
 * miután az utalás megérkezett.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly mailer: MailerService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      subscription,
      vehicleCount,
      memberCount,
      pendingInvites,
      documentsThisMonth,
      features,
    ] = await Promise.all([
      this.prisma.scoped.subscription.findFirst(),
      this.prisma.scoped.vehicle.count(),
      this.prisma.scoped.membership.count(),
      this.prisma.scoped.invitation.count({
        where: { acceptedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.scoped.document.count({
        where: { createdAt: { gte: monthStart } },
      }),
      this.featureFlags.getEffectiveFeatures(),
    ]);

    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limits = PLAN_LIMITS[planTier];

    return {
      plan: planTier,
      status: subscription?.status ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      limits: {
        maxVehicles: limits.maxVehicles,
        maxUsers: limits.maxUsers,
        maxDocumentsPerMonth: limits.maxDocumentsPerMonth,
        maxStorageBytes: limits.maxStorageBytes,
      },
      usage: {
        vehicles: vehicleCount,
        users: memberCount + pendingInvites,
        documentsThisMonth,
      },
      features,
    };
  }

  /**
   * Utalásos előfizetés igénylése. Nem változtatja meg azonnal a csomagot –
   * e-mailt küld a kliensnek (utalási adatok) és értesíti a fejlesztőt. Az
   * aktiválás az utalás megérkezése után, a Super Admin panelen történik.
   */
  async requestSubscription(
    tenantId: string,
    userId: string,
    dto: RequestSubscriptionDto,
  ) {
    const planTier = dto.planTier;
    const amount = PLAN_PRICES[planTier];
    const currency = PLAN_CURRENCY;
    const bank = this.config.bankTransfer;
    const reference = `VLR-${tenantId.slice(0, 8).toUpperCase()}-${planTier}`;

    const [tenant, user] = await Promise.all([
      this.prisma.system.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, email: true },
      }),
      this.prisma.system.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
    ]);

    const clientEmail = tenant?.email ?? user?.email ?? null;
    const amountLabel = `${amount.toLocaleString('hu-HU')} ${currency}`;

    // 1) Kliens e-mail: utalási adatok.
    if (clientEmail) {
      await this.mailer.send({
        to: clientEmail,
        subject: `Valloreg előfizetés – utalási adatok (${planTier})`,
        text: [
          `Köszönjük, hogy a Valloreg ${planTier} csomagot választottad!`,
          ``,
          `Az előfizetés aktiválásához kérjük, utald át a következő összeget:`,
          ``,
          `Összeg:      ${amountLabel} / hó`,
          `Kedvezményezett: ${bank.beneficiary || '(beállítás alatt)'}`,
          `IBAN/Számla: ${bank.iban || '(beállítás alatt)'}`,
          `Bank:        ${bank.bank || '-'}`,
          bank.swift ? `SWIFT:       ${bank.swift}` : ``,
          `Közlemény:   ${reference}`,
          ``,
          `Kérjük, a közleménybe MINDENKÉPP írd be a fenti azonosítót (${reference}),`,
          `hogy a befizetést a céghez tudjuk rendelni.`,
          ``,
          `Az utalás beérkezése után aktiváljuk az előfizetést. A 14 napos`,
          `próbaidőszak alatt minden funkció elérhető.`,
          ``,
          `Üdvözlettel,`,
          `Valloreg`,
        ]
          .filter((line) => line !== undefined)
          .join('\n'),
      });
    }

    // 2) Fejlesztői értesítés (e-mail).
    if (bank.notifyEmail) {
      await this.mailer.send({
        to: bank.notifyEmail,
        subject: `Új előfizetés-igénylés: ${tenant?.name ?? tenantId} – ${planTier}`,
        text: [
          `Új utalásos előfizetés-igénylés érkezett.`,
          ``,
          `Cég:       ${tenant?.name ?? tenantId}`,
          `Cég e-mail: ${clientEmail ?? '-'}`,
          `Csomag:    ${planTier}`,
          `Összeg:    ${amountLabel} / hó`,
          `Közlemény: ${reference}`,
          ``,
          `Az utalás beérkezése után a Super Admin panelen állítsd a csomagot`,
          `${planTier}-re és az állapotot ACTIVE-ra.`,
        ].join('\n'),
      });
    }

    // 3) Push a platform adminoknak (ha van feliratkozásuk).
    const admins = await this.prisma.system.user.findMany({
      where: { isPlatformAdmin: true },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.notifications.sendToUser(admin.id, {
          title: 'Új előfizetés-igénylés',
          body: `${tenant?.name ?? tenantId} – ${planTier} (${amountLabel})`,
          url: '/admin',
        }),
      ),
    );

    // 4) Audit.
    await this.audit.log({
      tenantId,
      userId,
      action: 'billing.subscription_requested',
      resourceType: 'Subscription',
      metadata: { planTier, amount, currency, reference },
    });

    return {
      plan: planTier,
      amount,
      currency,
      reference,
      bank: {
        beneficiary: bank.beneficiary,
        iban: bank.iban,
        bank: bank.bank,
        swift: bank.swift,
      },
      emailedTo: clientEmail,
    };
  }
}
