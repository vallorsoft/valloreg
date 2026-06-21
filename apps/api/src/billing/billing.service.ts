import { Injectable } from '@nestjs/common';
import { PLAN_LIMITS, PlanTier } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * Előfizetés-áttekintés a cég számára: aktuális csomag, állapot, limitek és a
 * valós használat (járművek, felhasználók, havi dokumentumok), valamint az
 * effektív feature-ök. Minden lekérdezés tenant-scope-olt.
 *
 * Megjegyzés: a tényleges csomagváltás (Stripe checkout/portal) külön, a
 * fizetési szolgáltató kulcsainak beállítása után köthető be.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagsService,
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
}
