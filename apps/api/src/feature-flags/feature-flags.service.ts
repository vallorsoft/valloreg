import { Injectable } from '@nestjs/common';
import {
  ALL_FEATURE_KEYS,
  FeatureKey,
  PLAN_LIMITS,
  PlanTier,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * A cég EFFEKTÍV feature-jeit számolja: csomag-alap ∪ override.
 * - A csomag (Subscription.planTier) adja az alap feature-halmazt.
 * - A FeatureFlagOverride bekapcsolhat (enabled=true) vagy kikapcsolhat
 *   (enabled=false) egy konkrét kulcsot.
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Az aktív tenant effektív feature-kulcsai. Tenant kontextus szükséges
   * (a scoped kliensen keresztül fut).
   */
  async getEffectiveFeatures(): Promise<FeatureKey[]> {
    const [subscription, overrides] = await Promise.all([
      this.prisma.scoped.subscription.findFirst({
        select: { planTier: true },
      }),
      this.prisma.scoped.featureFlagOverride.findMany({
        select: { key: true, enabled: true },
      }),
    ]);

    const planTier = (subscription?.planTier ?? PlanTier.START) as PlanTier;
    const base = new Set<FeatureKey>(PLAN_LIMITS[planTier].features);

    for (const override of overrides) {
      if (!this.isFeatureKey(override.key)) continue;
      if (override.enabled) {
        base.add(override.key);
      } else {
        base.delete(override.key);
      }
    }

    return Array.from(base);
  }

  /** Igaz, ha a megadott feature engedélyezett az aktív tenantnál. */
  async isEnabled(feature: FeatureKey): Promise<boolean> {
    const features = await this.getEffectiveFeatures();
    return features.includes(feature);
  }

  private isFeatureKey(key: string): key is FeatureKey {
    return (ALL_FEATURE_KEYS as readonly string[]).includes(key);
  }
}
