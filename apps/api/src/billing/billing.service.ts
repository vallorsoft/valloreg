import { Injectable } from '@nestjs/common';
import {
  effectiveStorageBytes,
  isValidStorageAddonGB,
  PLAN_CURRENCY,
  PLAN_LIMITS,
  PLAN_PRICES,
  PlanTier,
  storageAddonPrice,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { MailerService } from '../storage/mailer.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../common/exceptions/app.exception';
import type { RequestSubscriptionDto } from './dto/request-subscription.dto';
import type { RequestStorageAddonDto } from './dto/request-storage-addon.dto';

/**
 * Előfizetés-áttekintés és utalásos előfizetés-/extra-tárhely-igénylés.
 *
 * Fizetés: NINCS bankkártya (Stripe) – a kliens BANKI UTALÁSSAL fizet. Igényléskor
 * a kliens e-mailben megkapja az utalási adatokat (a fejlesztő bankszámláját,
 * az összeget és a közlemény-azonosítót), a fejlesztő pedig értesítést kap, hogy
 * várja az utalást. A tényleges aktiválást (csomag / extra tárhely + ACTIVE) a
 * Super Admin végzi, miután az utalás megérkezett.
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
      documentBytes,
      vehicleDocumentBytes,
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
      this.prisma.scoped.vehicleDocument.aggregate({
        _sum: { sizeBytes: true },
      }),
      this.featureFlags.getEffectiveFeatures(),
    ]);

    const planTier = (subscription?.planTier ?? PlanTier.START) as PlanTier;
    const limits = PLAN_LIMITS[planTier];
    const extraStorageGB = subscription?.extraStorageGB ?? 0;
    const storageBytes =
      (documentBytes._sum.sizeBytes ?? 0) +
      (vehicleDocumentBytes._sum.sizeBytes ?? 0);

    return {
      plan: planTier,
      status: subscription?.status ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      extraStorageGB,
      limits: {
        maxVehicles: limits.maxVehicles,
        maxUsers: limits.maxUsers,
        maxDocumentsPerMonth: limits.maxDocumentsPerMonth,
        // A tényleges tárhely-keret: csomag alap + megvásárolt extra.
        maxStorageBytes: effectiveStorageBytes(planTier, extraStorageGB),
      },
      usage: {
        vehicles: vehicleCount,
        users: memberCount + pendingInvites,
        documentsThisMonth,
        storageBytes,
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

    const { clientEmail, tenantName } = await this.loadBillingContacts(
      tenantId,
      userId,
    );
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
        subject: `Új előfizetés-igénylés: ${tenantName ?? tenantId} – ${planTier}`,
        text: [
          `Új utalásos előfizetés-igénylés érkezett.`,
          ``,
          `Cég:       ${tenantName ?? tenantId}`,
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
    await this.notifyPlatformAdmins(
      'Új előfizetés-igénylés',
      `${tenantName ?? tenantId} – ${planTier} (${amountLabel})`,
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

  /**
   * Utalásos extra-tárhely igénylése (+5 / +10 / +25 GB, havi díjjal). Ugyanaz a
   * folyamat, mint az előfizetésnél: e-mail a kliensnek + fejlesztői értesítés.
   * Az aktiválást (extraStorageGB beállítása) a Super Admin végzi az utalás után.
   */
  async requestStorageAddon(
    tenantId: string,
    userId: string,
    dto: RequestStorageAddonDto,
  ) {
    const extraGB = dto.extraGB;
    if (!isValidStorageAddonGB(extraGB)) {
      throw AppException.validation('Érvénytelen extra-tárhely opció.');
    }
    const amount = storageAddonPrice(extraGB) as number;
    const currency = PLAN_CURRENCY;
    const bank = this.config.bankTransfer;
    const reference = `VLR-${tenantId.slice(0, 8).toUpperCase()}-STO${extraGB}`;

    const { clientEmail, tenantName } = await this.loadBillingContacts(
      tenantId,
      userId,
    );
    const amountLabel = `${amount.toLocaleString('hu-HU')} ${currency}`;

    if (clientEmail) {
      await this.mailer.send({
        to: clientEmail,
        subject: `Valloreg extra tárhely – utalási adatok (+${extraGB} GB)`,
        text: [
          `Köszönjük, hogy +${extraGB} GB extra tárhelyet igényeltél!`,
          ``,
          `Az aktiváláshoz kérjük, utald át a következő havi díjat:`,
          ``,
          `Extra tárhely: +${extraGB} GB`,
          `Összeg:      ${amountLabel} / hó`,
          `Kedvezményezett: ${bank.beneficiary || '(beállítás alatt)'}`,
          `IBAN/Számla: ${bank.iban || '(beállítás alatt)'}`,
          `Bank:        ${bank.bank || '-'}`,
          bank.swift ? `SWIFT:       ${bank.swift}` : ``,
          `Közlemény:   ${reference}`,
          ``,
          `Kérjük, a közleménybe MINDENKÉPP írd be a fenti azonosítót (${reference}).`,
          `Az utalás beérkezése után aktiváljuk az extra tárhelyet.`,
          ``,
          `Üdvözlettel,`,
          `Valloreg`,
        ]
          .filter((line) => line !== undefined)
          .join('\n'),
      });
    }

    if (bank.notifyEmail) {
      await this.mailer.send({
        to: bank.notifyEmail,
        subject: `Új extra-tárhely igénylés: ${tenantName ?? tenantId} – +${extraGB} GB`,
        text: [
          `Új utalásos extra-tárhely igénylés érkezett.`,
          ``,
          `Cég:       ${tenantName ?? tenantId}`,
          `Cég e-mail: ${clientEmail ?? '-'}`,
          `Extra tárhely: +${extraGB} GB`,
          `Összeg:    ${amountLabel} / hó`,
          `Közlemény: ${reference}`,
          ``,
          `Az utalás beérkezése után a Super Admin panelen állítsd be az`,
          `extra tárhelyet (+${extraGB} GB).`,
        ].join('\n'),
      });
    }

    await this.notifyPlatformAdmins(
      'Új extra-tárhely igénylés',
      `${tenantName ?? tenantId} – +${extraGB} GB (${amountLabel})`,
    );

    await this.audit.log({
      tenantId,
      userId,
      action: 'billing.storage_addon_requested',
      resourceType: 'Subscription',
      metadata: { extraGB, amount, currency, reference },
    });

    return {
      extraGB,
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

  /** A cég és az igénylő e-mailje az utalási értesítésekhez. */
  private async loadBillingContacts(tenantId: string, userId: string) {
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
    return {
      clientEmail: tenant?.email ?? user?.email ?? null,
      tenantName: tenant?.name ?? null,
    };
  }

  /** Push értesítés minden platform-adminnak (ha van feliratkozásuk). */
  private async notifyPlatformAdmins(title: string, body: string) {
    const admins = await this.prisma.system.user.findMany({
      where: { isPlatformAdmin: true },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        this.notifications.sendToUser(admin.id, {
          title,
          body,
          url: '/admin',
        }),
      ),
    );
  }
}
