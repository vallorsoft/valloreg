import { Injectable } from '@nestjs/common';
import { PlanTier as DbPlanTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailerService } from '../storage/mailer.service';
import { BillingSettingsService } from '../billing/billing-settings.service';
import { AppException } from '../common/exceptions/app.exception';
import type { SetSubscriptionDto } from './dto/set-subscription.dto';
import type { SetFeatureOverrideDto } from './dto/set-feature-override.dto';
import type { SetBillingSettingsDto } from './dto/set-billing-settings.dto';

/**
 * Super Admin (platform) műveletek a cégek (tenantek) felett.
 *
 * FONTOS: a platform admin NEM tenant-kontextusban dolgozik, ezért MINDEN
 * lekérdezés a SYSTEM (unscoped) klienst használja. A platform admin a cégek
 * metaadatait és aggregátumait látja (tagok/járművek/dokumentumok száma,
 * előfizetés, feature flag-ek) – a számlák tartalmát NEM.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
    private readonly billingSettings: BillingSettingsService,
  ) {}

  /** Cégek listája aggregátumokkal és előfizetéssel. */
  async listTenants() {
    const tenants = await this.prisma.system.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          select: {
            planTier: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
        _count: {
          select: { memberships: true, vehicles: true, documents: true },
        },
      },
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      createdAt: t.createdAt,
      subscription: t.subscription,
      counts: {
        members: t._count.memberships,
        vehicles: t._count.vehicles,
        documents: t._count.documents,
      },
    }));
  }

  /** Egy cég részletei: előfizetés, tagok, feature override-ok, aggregátumok. */
  async getTenant(id: string) {
    const tenant = await this.prisma.system.tenant.findUnique({
      where: { id },
      include: {
        subscription: true,
        memberships: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        featureFlagOverrides: { select: { key: true, enabled: true } },
        _count: {
          select: {
            memberships: true,
            vehicles: true,
            documents: true,
            invoices: true,
          },
        },
      },
    });
    if (!tenant) throw AppException.notFound('A cég nem található.');

    return {
      id: tenant.id,
      name: tenant.name,
      taxNumber: tenant.taxNumber,
      contactName: tenant.contactName,
      email: tenant.email,
      phone: tenant.phone,
      extraStorageGb: tenant.extraStorageGb,
      createdAt: tenant.createdAt,
      subscription: tenant.subscription,
      members: tenant.memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        user: m.user,
      })),
      featureOverrides: tenant.featureFlagOverrides,
      counts: {
        members: tenant._count.memberships,
        vehicles: tenant._count.vehicles,
        documents: tenant._count.documents,
        invoices: tenant._count.invoices,
      },
    };
  }

  /** Előfizetés beállítása (csomag + állapot). */
  async setSubscription(
    actorUserId: string,
    tenantId: string,
    dto: SetSubscriptionDto,
  ) {
    await this.assertTenantExists(tenantId);

    const planTier = DbPlanTier[dto.planTier];
    const status = dto.status;

    const subscription = await this.prisma.system.subscription.upsert({
      where: { tenantId },
      create: { tenantId, planTier, status },
      update: { planTier, status },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'admin.subscription_set',
      resourceType: 'Subscription',
      resourceId: subscription.id,
      metadata: { planTier: dto.planTier, status: dto.status },
    });

    return subscription;
  }

  /** Számla-/utalási adatok lekérése (effektív: DB ∪ env-tartalék). */
  getBillingSettings() {
    return this.billingSettings.getEffective();
  }

  /**
   * Teszt-email a Brevo-konfiguráció ellenőrzéséhez. Visszaadja a küldés
   * eredményét (ok/hiba), hogy a Super Admin lássa, jó-e a kulcs + feladó.
   */
  async sendTestEmail(actorUserId: string, to: string) {
    const result = await this.mailer.send({
      to,
      subject: 'Valloreg – teszt e-mail (Brevo)',
      text:
        'Ez egy teszt e-mail a Valloreg rendszerből (Brevo).\n\n' +
        'Ha ezt megkaptad, a rendszer-emailek kézbesítése működik.',
    });
    await this.audit.log({
      userId: actorUserId,
      action: 'admin.test_email_sent',
      resourceType: 'Mailer',
      resourceId: to,
      metadata: { ok: result.ok, status: result.status ?? null },
    });
    return result;
  }

  /** Számla-/utalási adatok mentése (csak Super Admin). */
  async setBillingSettings(actorUserId: string, dto: SetBillingSettingsDto) {
    const result = await this.billingSettings.update(dto);
    await this.audit.log({
      userId: actorUserId,
      action: 'admin.billing_settings_set',
      resourceType: 'BillingSettings',
      resourceId: 'default',
    });
    return result;
  }

  /** Vásárolt extra tárhely (GB) beállítása egy cégre (utalás után). */
  async setExtraStorage(actorUserId: string, tenantId: string, gb: number) {
    await this.assertTenantExists(tenantId);

    const tenant = await this.prisma.system.tenant.update({
      where: { id: tenantId },
      data: { extraStorageGb: gb },
      select: { id: true, extraStorageGb: true },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'admin.extra_storage_set',
      resourceType: 'Tenant',
      resourceId: tenantId,
      metadata: { extraStorageGb: gb },
    });

    return tenant;
  }

  /** Feature flag override be/kikapcsolása egy cégre. */
  async setFeatureOverride(
    actorUserId: string,
    tenantId: string,
    key: string,
    dto: SetFeatureOverrideDto,
  ) {
    await this.assertTenantExists(tenantId);

    const override = await this.prisma.system.featureFlagOverride.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, enabled: dto.enabled },
      update: { enabled: dto.enabled },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'admin.feature_override_set',
      resourceType: 'FeatureFlagOverride',
      resourceId: override.id,
      metadata: { key, enabled: dto.enabled },
    });

    return override;
  }

  /** Feature override eltávolítása (visszaáll a csomag alapértelmezésére). */
  async removeFeatureOverride(
    actorUserId: string,
    tenantId: string,
    key: string,
  ): Promise<void> {
    await this.assertTenantExists(tenantId);

    await this.prisma.system.featureFlagOverride.deleteMany({
      where: { tenantId, key },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'admin.feature_override_removed',
      resourceType: 'FeatureFlagOverride',
      metadata: { key },
    });
  }

  private async assertTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.system.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw AppException.notFound('A cég nem található.');
  }
}
