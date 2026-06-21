import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantRole } from '@valloreg/shared';

/**
 * A kérés-szintű tenant kontextus, amit a TenantGuard tölt fel és a Prisma
 * tenant-scope kiterjesztés olvas. AsyncLocalStorage-ben él, így a teljes
 * async hívásláncon végigöröklődik anélkül, hogy kézzel kéne átadni.
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: TenantRole;
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  /**
   * A megadott kontextusban futtatja a callback-et (és minden async
   * leszármazottját). Tesztekhez / explicit scope-hoz hasznos.
   */
  run<T>(context: TenantContext, callback: () => T): T {
    return this.als.run(context, callback);
  }

  /**
   * Belép a kontextusba a JELENLEGI async folyamhoz (callback nélkül).
   * A TenantGuard ezt használja: a guard `canActivate`-je visszatér, de a
   * controller handler ugyanazon az async láncon fut tovább, így örökli a
   * kontextust. (Az enterWith a NestJS guard→handler folyam esetén megbízható,
   * mert a `Reflect`-alapú interceptor lánc nem szakítja meg az async kontextust.)
   */
  enter(context: TenantContext): void {
    this.als.enterWith(context);
  }

  /** Az aktuális kontextus, vagy undefined ha nincs (pl. auth/system query). */
  get(): TenantContext | undefined {
    return this.als.getStore();
  }

  /** Az aktuális tenantId, vagy undefined ha nincs kontextus. */
  getTenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }
}
