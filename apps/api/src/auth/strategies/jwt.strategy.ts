import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/app-config.service';
import type { AuthUser } from '../../common/types/request-context';

/**
 * Access token payload. A tenant SZÁNDÉKOSAN nincs benne – azt kérésenként
 * az `x-tenant-id` header választja ki, amit a TenantGuard validál.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  isPlatformAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  /**
   * A passport által dekódolt payload-ból a request.user objektumot építi.
   */
  validate(payload: AccessTokenPayload): AuthUser {
    return {
      userId: payload.sub,
      email: payload.email,
      isPlatformAdmin: payload.isPlatformAdmin,
    };
  }
}
