import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  ActiveTenant,
  AuthenticatedRequest,
} from '../types/request-context';

/**
 * Az aktív tenant (id + szerepkör) injektálása controller paraméterként.
 * Pl. `@CurrentTenant() tenant: ActiveTenant`.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveTenant | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenant;
  },
);
