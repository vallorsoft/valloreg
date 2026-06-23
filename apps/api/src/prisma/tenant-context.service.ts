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

/**
 * MUTÁLHATÓ tároló. A kérés ELEJÉN (TenantContextMiddleware) egy üres holder-t
 * nyitunk a teljes kérésre `als.run()`-nal, majd a TenantGuard ennek a holder-nek
 * a `current` mezőjét TÖLTI FEL. Mivel a guard a már létező objektumot MUTÁLJA
 * (nem új scope-ot nyit), az érték végigöröklődik a guard→handler async láncon –
 * szemben az `enterWith`-tel, ami a NestJS guard→handler határon megbízhatatlan.
 */
interface MutableHolder {
  current?: TenantContext;
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<MutableHolder>();

  /**
   * Üres ALS scope nyitása a TELJES kérésre, és a callback futtatása benne.
   * A TenantContextMiddleware hívja: így a guard→handler lánc VÉGIG ugyanabban
   * az async kontextusban fut, és a guard által később beállított érték a
   * handlerben (és a scoped Prisma kliensben) is látszik.
   */
  run<T>(callback: () => T): T {
    return this.als.run({}, callback);
  }

  /**
   * Explicit kontextusban futtatás (tesztekhez / háttérfeladatokhoz):
   * azonnal feltöltött holder-rel nyit scope-ot.
   */
  runWith<T>(context: TenantContext, callback: () => T): T {
    return this.als.run({ current: context }, callback);
  }

  /**
   * Beállítja az aktuális kérés tenant kontextusát. A TenantGuard hívja, miután
   * a membership-et ellenőrizte. A meglévő (middleware által nyitott) holder-t
   * MUTÁLJA, ezért az érték a teljes async láncon látszik. Ha valamiért nincs
   * aktív holder (pl. middleware nélküli hívás), `enterWith`-tel nyit egyet.
   */
  set(context: TenantContext): void {
    const holder = this.als.getStore();
    if (holder) {
      holder.current = context;
    } else {
      this.als.enterWith({ current: context });
    }
  }

  /** Az aktuális kontextus, vagy undefined ha nincs (pl. auth/system query). */
  get(): TenantContext | undefined {
    return this.als.getStore()?.current;
  }

  /** Az aktuális tenantId, vagy undefined ha nincs kontextus. */
  getTenantId(): string | undefined {
    return this.als.getStore()?.current?.tenantId;
  }
}
