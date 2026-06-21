import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '@valloreg/shared';

export const REQUIRE_FEATURE_KEY = 'requireFeature';

/**
 * A végpont csak akkor érhető el, ha a cég effektív feature-jei között
 * szerepel a megadott kulcs (csomag ∪ override). A FeatureGuard ellenőrzi.
 */
export const RequireFeature = (feature: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);
