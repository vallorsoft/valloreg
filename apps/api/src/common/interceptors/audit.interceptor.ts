import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import type { AuthenticatedRequest } from '../types/request-context';

/**
 * Opcionális audit interceptor. NEM globálisan aktivált – a részletes,
 * üzletileg jelentős auditot a service-ek végzik (pontos action/metadata).
 * Ez egy generikus, mutáló (POST/PATCH/PUT/DELETE) HTTP kérés-naplózó, amit
 * controllerre/handler-re lehet tenni `@UseInterceptors(AuditInterceptor)`-ral,
 * ha durva szemcsézettségű audit kell.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      AuthenticatedRequest & { method: string; url: string }
    >();

    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(
      request.method,
    );

    return next.handle().pipe(
      tap(() => {
        if (!isMutation) return;
        void this.audit.log({
          tenantId: request.tenant?.tenantId ?? null,
          userId: request.user?.userId ?? null,
          action: `http.${request.method.toLowerCase()}`,
          resourceType: 'HttpRequest',
          resourceId: request.url,
          ip: request.ip,
        });
      }),
    );
  }
}
