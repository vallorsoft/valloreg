import type { ExecutionContext } from '@nestjs/common';
import { TenantRole } from '@valloreg/shared';
import { TenantGuard } from '../../src/common/guards/tenant.guard';
import { AppException } from '../../src/common/exceptions/app.exception';
import { ErrorCode } from '@valloreg/shared';
import { HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantContextService } from '../../src/prisma/tenant-context.service';
import type { AuthenticatedRequest } from '../../src/common/types/request-context';
import { cleanup, makePrisma, SeededTenant, seedTenant } from './helpers';

/**
 * A TenantGuard valódi membership-ellenőrzése a system kliensen, élő Postgres
 * ellen. Egy hamis ExecutionContext-et adunk neki egy mutálható request-tel.
 *
 * Élő Postgres + generált @prisma/client kell hozzá (a CI futtatja).
 */
describe('TenantGuard membership-ellenőrzés (integráció)', () => {
  let prisma: PrismaService;
  let ctx: TenantContextService;
  let guard: TenantGuard;

  // A user, akinek van membershipje a saját tenantjában.
  let member: SeededTenant;
  // Egy MÁSIK tenant, amelyben a fenti usernek NINCS membershipje.
  let otherTenant: SeededTenant;

  /**
   * Hamis ExecutionContext: a switchToHttp().getRequest() a megadott (mutálható)
   * request objektumot adja vissza, hogy a guard rá tudja írni a request.tenant-et.
   */
  function makeContext(request: AuthenticatedRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: <T>() => request as T,
      }),
    } as unknown as ExecutionContext;
  }

  beforeAll(async () => {
    ({ prisma, ctx } = makePrisma());
    await prisma.onModuleInit();
    guard = new TenantGuard(prisma, ctx);

    member = await seedTenant(prisma, TenantRole.FLEET_MANAGER);
    // A másik tenant külön usere nem érdekes – csak a tenantId kell, amelyben
    // a `member.userId`-nak NINCS membershipje.
    otherTenant = await seedTenant(prisma, TenantRole.OWNER);
  });

  afterAll(async () => {
    await cleanup(prisma, {
      tenantIds: [member?.tenantId, otherTenant?.tenantId].filter(Boolean) as string[],
      userIds: [member?.userId, otherTenant?.userId].filter(Boolean) as string[],
    });
    await prisma.onModuleDestroy();
  });

  it('érvényes membership: canActivate true és beállítja a request.tenant-et', async () => {
    const request: AuthenticatedRequest = {
      user: { userId: member.userId, email: 'x', isPlatformAdmin: false },
      headers: { 'x-tenant-id': member.tenantId },
    };

    const result = await guard.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect(request.tenant).toEqual({
      tenantId: member.tenantId,
      role: TenantRole.FLEET_MANAGER,
    });
  });

  it('hiányzó x-tenant-id: TENANT_ACCESS_DENIED (403) dobás', async () => {
    const request: AuthenticatedRequest = {
      user: { userId: member.userId, email: 'x', isPlatformAdmin: false },
      headers: {},
    };

    // A HttpException a státuszt getStatus()-szal adja (nincs enumerable `status`),
    // ezért try/catch-ben vizsgáljuk a code-ot és a HTTP státuszt.
    await expect(async () => {
      try {
        await guard.canActivate(makeContext(request));
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).code).toBe(ErrorCode.TENANT_ACCESS_DENIED);
        expect((err as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
        throw err;
      }
    }).rejects.toBeInstanceOf(AppException);
  });

  it('cross-tenant: nincs membership a kért tenantban → TENANT_ACCESS_DENIED (403)', async () => {
    const request: AuthenticatedRequest = {
      user: { userId: member.userId, email: 'x', isPlatformAdmin: false },
      // A user a MÁSIK tenant id-jával próbálkozik, ahol nincs membershipje.
      headers: { 'x-tenant-id': otherTenant.tenantId },
    };

    await expect(async () => {
      try {
        await guard.canActivate(makeContext(request));
      } catch (err) {
        expect(err).toBeInstanceOf(AppException);
        expect((err as AppException).code).toBe(ErrorCode.TENANT_ACCESS_DENIED);
        expect((err as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
        throw err;
      }
    }).rejects.toBeInstanceOf(AppException);

    expect(request.tenant).toBeUndefined();
  });
});
