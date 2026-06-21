import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/request-context';

/**
 * Platform (Super Admin) guard. Csak `isPlatformAdmin` felhasználót enged át.
 * A JwtAuthGuard UTÁN fut (a request.user-re támaszkodik). NEM igényel tenant
 * kontextust – a platform admin cégek felett dolgozik.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw AppException.unauthorized();
    }
    if (!user.isPlatformAdmin) {
      throw AppException.forbidden('Platform admin jogosultság szükséges.');
    }
    return true;
  }
}
