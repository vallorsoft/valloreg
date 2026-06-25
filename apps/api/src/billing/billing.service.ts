import { Injectable } from '@nestjs/common';
import {
  BillingInterval,
  effectiveStorageBytes,
  PLAN_CURRENCY,
  PLAN_LIMITS,
  planPrice,
  PlanTier,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { BillingSettingsService } from './billing-settings.service';
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
    private readonly tenantContext: TenantContextService,
    private readonly billingSettings: BillingSettingsService,
  ) {}

  async getOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const tenantId = this.tenantContext.getTenantId();

    const [
      subscription,
      vehicleCount,
      memberCount,
      pendingInvites,
      documentsThisMonth,
      docSize,
      vehicleDocSize,
      tenant,
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
      this.prisma.scoped.document.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.scoped.vehicleDocument.aggregate({ _sum: { sizeBytes: true } }),
      tenantId
        ? this.prisma.system.tenant.findUnique({
            where: { id: tenantId },
            select: { extraStorageGb: true },
          })
        : Promise.resolve(null),
      this.featureFlags.getEffectiveFeatures(),
    ]);

    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limits = PLAN_LIMITS[planTier];

    const extraStorageGb = tenant?.extraStorageGb ?? 0;
    const storageBytes =
      (docSize._sum.sizeBytes ?? 0) + (vehicleDocSize._sum.sizeBytes ?? 0);
    const maxStorageBytes = effectiveStorageBytes(
      limits.maxStorageBytes,
      extraStorageGb,
    );

    return {
      plan: planTier,
      status: subscription?.status ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      limits: {
        maxVehicles: limits.maxVehicles,
        maxUsers: limits.maxUsers,
        maxDocumentsPerMonth: limits.maxDocumentsPerMonth,
        // Effektív keret: csomag-tárhely + vásárolt extra.
        maxStorageBytes,
      },
      usage: {
        vehicles: vehicleCount,
        users: memberCount + pendingInvites,
        documentsThisMonth,
        storageBytes,
      },
      extraStorageGb,
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
    const interval = dto.interval ?? BillingInterval.MONTHLY;
    const isYearly = interval === BillingInterval.YEARLY;
    const amount = planPrice(planTier, interval);
    const currency = PLAN_CURRENCY;
    // Effektív számla-/utalási adatok: a Super Admin DB-beállítása, üresnél env.
    const bank = await this.billingSettings.getEffective();
    const reference = `VLR-${tenantId.slice(0, 8).toUpperCase()}-${planTier}-${
      isYearly ? 'Y' : 'M'
    }`;

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
    const periodLabel = isYearly ? '/ év' : '/ hó';
    const cycleLabel = isYearly ? 'éves' : 'havi';

    // 1) Kliens e-mail: utalási adatok.
    if (clientEmail) {
      await this.mailer.send({
        to: clientEmail,
        subject: `Valloreg előfizetés – utalási adatok (${planTier}, ${cycleLabel})`,
        text: [
          `Köszönjük, hogy a Valloreg ${planTier} csomagot választottad!`,
          ``,
          `Az előfizetés aktiválásához kérjük, utald át a következő összeget:`,
          ``,
          `Csomag:      ${planTier} (${cycleLabel} számlázás)`,
          `Összeg:      ${amountLabel} ${periodLabel}`,
          isYearly
            ? `Kedvezmény:  éves fizetésnél 12 hónap helyett csak 11 havidíj (1 hónap ingyen)`
            : ``,
          `Kedvezményezett: ${bank.beneficiary || '(beállítás alatt)'}`,
          `IBAN/Számla: ${bank.iban || '(beállítás alatt)'}`,
          `Bank:        ${bank.bankName || '-'}`,
          bank.swift ? `SWIFT:       ${bank.swift}` : ``,
          `Közlemény:   ${reference}`,
          bank.companyName ? `Számlakibocsátó: ${bank.companyName}` : ``,
          bank.taxNumber ? `Adószám: ${bank.taxNumber}` : ``,
          bank.address ? `Cím: ${bank.address}` : ``,
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
        subject: `Új előfizetés-igénylés: ${tenant?.name ?? tenantId} – ${planTier} (${cycleLabel})`,
        text: [
          `Új utalásos előfizetés-igénylés érkezett.`,
          ``,
          `Cég:       ${tenant?.name ?? tenantId}`,
          `Cég e-mail: ${clientEmail ?? '-'}`,
          `Csomag:    ${planTier}`,
          `Ciklus:    ${cycleLabel}`,
          `Összeg:    ${amountLabel} ${periodLabel}`,
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
          body: `${tenant?.name ?? tenantId} – ${planTier} (${cycleLabel}, ${amountLabel})`,
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
      metadata: { planTier, interval, amount, currency, reference },
    });

    return {
      plan: planTier,
      interval,
      amount,
      currency,
      reference,
      bank: {
        beneficiary: bank.beneficiary,
        iban: bank.iban,
        bank: bank.bankName,
        swift: bank.swift,
      },
      emailedTo: clientEmail,
    };
  }
}
