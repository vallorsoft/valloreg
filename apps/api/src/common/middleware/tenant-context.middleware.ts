import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextService } from '../../prisma/tenant-context.service';

/**
 * A kérés legelején megnyit egy üres tenant-kontextus ALS scope-ot, és a kérés
 * további feldolgozását (guardok, handler, scoped Prisma kliens) ENNEK a scope-nak
 * a belsejében futtatja. Így a TenantGuard által később beállított tenantId a
 * teljes async láncon végigöröklődik – ez a megbízható minta az `enterWith`
 * helyett, ami a NestJS guard→handler határon elveszhet.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(_req: Request, _res: Response, next: NextFunction): void {
    this.tenantContext.run(() => next());
  }
}
