import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureKey } from '@valloreg/shared';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/request-context';

/**
 * Feature guard. A @RequireFeature(key) jelölésű végpontokat csak akkor engedi,
 * ha a cég effektív feature-jei közt szerepel a kulcs. Backend-szintű tiltás
 * (nem csak UI). A TenantGuard UTÁN fut.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureKey>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.tenant) {
      throw AppException.tenantAccessDenied();
    }

    const enabled = await this.featureFlags.isEnabled(required);
    if (!enabled) {
      throw AppException.featureDisabled(
        `A(z) ${required} funkció nincs engedélyezve a csomagodban.`,
      );
    }

    return true;
  }
}
