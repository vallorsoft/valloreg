import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

/**
 * A tenant-scope-olt modellek halmaza. Minden itt felsorolt modell lekérdezése
 * automatikusan a kérés tenantId-jára szűrődik. Ha NINCS tenant kontextus,
 * a kiterjesztés HIBÁT DOB (fail-closed) – cross-tenant szivárgás kizárva.
 *
 * NEM scope-olt (szándékosan): User, RefreshToken – ezek globálisak (auth).
 *
 * MEGJEGYZÉS (Prisma): a single-record update/delete `where`-ébe is injektáljuk a
 * tenantId-t. Ez a Prisma "extended where unique" képességére támaszkodik (GA a
 * Prisma 5+/6-ban): a `where: { id, tenantId }` érvényes, mert tartalmaz egy
 * unique mezőt (id) + egy szűrőt (tenantId). Így a tenant-eltérő rekord NEM
 * frissül/törlődik (a where nem talál), nem csak az olvasás szűr.
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  'Membership',
  'Invitation',
  'Subscription',
  'FeatureFlagOverride',
  'Supplier',
  'Vehicle',
  'Document',
  'Invoice',
  'InvoiceItem',
  'SupportAccess',
  'SupplierVehicleMapping',
  'ItemCategoryMapping',
  'Reminder',
  'VehicleDocument',
  'VehicleVerification',
  'VehicleScan',
  'VehicleParty',
  // Tenant és AuditLog NEM itt: lásd alább a megjegyzést.
]);

/**
 * Azok a read/list/aggregate műveletek, amelyekbe `where: { tenantId }`-t
 * injektálunk.
 */
const READ_OPERATIONS = new Set<string>([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/** Egy rekordon ható write műveletek, ahol where + create data is érintett. */
const SINGLE_WRITE_OPERATIONS = new Set<string>([
  'update',
  'delete',
  'upsert',
]);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Tenant-scope-olt kliens. MINDEN üzleti repository ezt használja a kéréseken
   * keresztül. Olvasáskor injektálja a tenantId szűrőt, íráskor a tenantId
   * mezőt; tenant kontextus nélkül dob.
   */
  public readonly scoped: PrismaClient;

  // Declared here for TypeScript; the actual value is set in the constructor
  // as an own-property getter so it captures the Proxy returned by PrismaClient.
  declare readonly system: PrismaClient;

  constructor(private readonly tenantContext: TenantContextService) {
    // Neon pooler URL-eknél (hostname tartalmaz "-pooler."-t) a Prisma extended
    // protokollt (prepared statements) használ alapból, amit a pgbouncer
    // transaction mode nem tud kezelni → minden lekérdezés 500-zal esik el.
    // A pgbouncer=true paraméter simple protokollra vált (nincs prepared statement),
    // és Prisma 5.10+ esetén a $transaction() automatikusan a DIRECT_URL-t veszi.
    const rawUrl = process.env.DATABASE_URL ?? '';
    const dbUrl = PrismaService.withPgBouncer(rawUrl);
    super({ datasources: { db: { url: dbUrl || rawUrl } } });

    // PrismaClient's constructor returns a Proxy. Prototype getters on subclasses
    // are called by that Proxy with 'this' = the raw target (no model delegates).
    // Defining 'system' as an own-property getter here captures 'this' = the
    // Proxy via the arrow function, so system.user / system.tenant etc. work.
    Object.defineProperty(this, 'system', {
      get: (): PrismaClient => this as unknown as PrismaClient,
      enumerable: false,
      configurable: true,
    });

    this.scoped = this.buildScopedClient();
  }

  /**
   * Ha a DATABASE_URL Neon pooler URL (tartalmaz "-pooler."-t) és még nincs
   * rajta pgbouncer=true, automatikusan hozzáadja. Más URL-eket változatlanul hagy.
   */
  private static withPgBouncer(url: string): string {
    if (!url || !url.includes('-pooler.') || url.includes('pgbouncer=true')) {
      return url;
    }
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}pgbouncer=true`;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma csatlakozott az adatbázishoz.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Explicit unscoped futtatás egy callback köré – olvashatóbb a hívás
   * helyén, ha jelezni akarjuk, hogy SZÁNDÉKOSAN kerüljük a scope-ot.
   */
  runUnscoped<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return fn(this.system);
  }

  private requireTenantId(model: string, operation: string): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      // Fail-closed: tenant-scope-olt modell tenant kontextus nélkül.
      this.logger.error(
        `Tenant kontextus nélküli scope-olt lekérdezés: ${model}.${operation}`,
      );
      throw new InternalServerErrorException(
        `Tenant kontextus hiányzik a(z) ${model}.${operation} művelethez. ` +
          `Tenant-scope-olt modellt csak aktív tenant kontextusban (TenantGuard) ` +
          `vagy a system kliensen keresztül szabad lekérdezni.`,
      );
    }
    return tenantId;
  }

  /**
   * A tenant-scope kiterjesztés felépítése. Prisma `$extends` query extension:
   *  - olvasásnál/updateMany/deleteMany: where AND tenantId
   *  - update/delete/upsert: where.tenantId + (upsert create) tenantId
   *  - create: data.tenantId
   *  - createMany: minden sorra tenantId
   */
  private buildScopedClient(): PrismaClient {
    const requireTenantId = this.requireTenantId.bind(this);

    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Csak a felsorolt üzleti modelleket scope-oljuk.
            if (!TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }

            const tenantId = requireTenantId(model, operation);
            const typedArgs = (args ?? {}) as Record<string, unknown>;

            if (READ_OPERATIONS.has(operation)) {
              typedArgs.where = mergeTenantWhere(typedArgs.where, tenantId);
              return query(typedArgs as never);
            }

            if (operation === 'create') {
              typedArgs.data = injectTenantId(typedArgs.data, tenantId);
              return query(typedArgs as never);
            }

            if (operation === 'createMany') {
              typedArgs.data = injectTenantIdMany(typedArgs.data, tenantId);
              return query(typedArgs as never);
            }

            if (SINGLE_WRITE_OPERATIONS.has(operation)) {
              typedArgs.where = mergeTenantWhere(typedArgs.where, tenantId);
              if (operation === 'upsert') {
                typedArgs.create = injectTenantId(typedArgs.create, tenantId);
              }
              return query(typedArgs as never);
            }

            // Ismeretlen művelet: óvatosságból tenantId-t várunk a where-ben.
            typedArgs.where = mergeTenantWhere(typedArgs.where, tenantId);
            return query(typedArgs as never);
          },
        },
      },
    });

    // A $extends a kiterjesztett klienst adja vissza; típusilag PrismaClient-kompatibilis.
    return extended as unknown as PrismaClient;
  }
}

/** A meglévő where mellé AND-eli a tenantId-t (nem írja felül a meglévő szűrőt). */
function mergeTenantWhere(
  where: unknown,
  tenantId: string,
): Record<string, unknown> {
  const base = (where ?? {}) as Record<string, unknown>;
  return { ...base, tenantId };
}

/** create data-ba teszi a tenantId-t (a hívó által megadott felülírja-e? nem: mi vagyunk a forrás). */
function injectTenantId(data: unknown, tenantId: string): Record<string, unknown> {
  const base = (data ?? {}) as Record<string, unknown>;
  return { ...base, tenantId };
}

function injectTenantIdMany(
  data: unknown,
  tenantId: string,
): Record<string, unknown>[] {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map((row) => injectTenantId(row, tenantId));
}
