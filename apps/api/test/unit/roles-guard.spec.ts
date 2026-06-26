import type { ExecutionContext } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ErrorCode, TenantRole } from '@valloreg/shared';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';
import { AppException } from '../../src/common/exceptions/app.exception';

/**
 * Prisma-mentes egységteszt a RolesGuard-hoz.
 * Csak Reflector mock + hamis ExecutionContext kell hozzá.
 */
describe('RolesGuard', () => {
  /** Reflector mock, amelynek a getAllAndOverride-ja megadott szerepköröket ad. */
  function makeReflector(roles: TenantRole[] | undefined): {
    reflector: Reflector;
    getAllAndOverride: jest.Mock;
  } {
    const getAllAndOverride = jest.fn().mockReturnValue(roles);
    const reflector = { getAllAndOverride } as unknown as Reflector;
    return { reflector, getAllAndOverride };
  }

  /** Hamis ExecutionContext, amely egy { tenant } kérést ad vissza. */
  function makeContext(request: unknown): ExecutionContext {
    const handler = (): void => {};
    class FakeClass {}
    return {
      getHandler: () => handler,
      getClass: () => FakeClass,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('átengedi, ha nincs @Roles metaadat (undefined)', () => {
    const { reflector, getAllAndOverride } = makeReflector(undefined);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ tenant: { role: TenantRole.OWNER } });

    expect(guard.canActivate(ctx)).toBe(true);
    // a Reflector a handler + class páron lett megkérdezve, a ROLES_KEY-jel
    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('átengedi, ha a @Roles üres tömb', () => {
    const { reflector } = makeReflector([]);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ tenant: { role: TenantRole.ACCOUNTANT } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('átengedi, ha a kért szerepkör egyezik a request.tenant.role-lal', () => {
    const { reflector } = makeReflector([TenantRole.OWNER, TenantRole.ADMIN]);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ tenant: { role: TenantRole.ADMIN } });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('AUTH_FORBIDDEN-t dob, ha a szerepkör nem egyezik', () => {
    const { reflector } = makeReflector([TenantRole.OWNER]);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({ tenant: { role: TenantRole.ACCOUNTANT } });

    expect(() => guard.canActivate(ctx)).toThrow(AppException);
    try {
      guard.canActivate(ctx);
      fail('vártunk egy AppException-t');
    } catch (err) {
      const e = err as AppException;
      expect(e).toBeInstanceOf(AppException);
      expect(e.code).toBe(ErrorCode.AUTH_FORBIDDEN);
      expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('TENANT_ACCESS_DENIED-t dob, ha hiányzik a request.tenant', () => {
    const { reflector } = makeReflector([TenantRole.OWNER]);
    const guard = new RolesGuard(reflector);
    const ctx = makeContext({});

    expect(() => guard.canActivate(ctx)).toThrow(AppException);
    try {
      guard.canActivate(ctx);
      fail('vártunk egy AppException-t');
    } catch (err) {
      const e = err as AppException;
      expect(e).toBeInstanceOf(AppException);
      expect(e.code).toBe(ErrorCode.TENANT_ACCESS_DENIED);
      expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });
});
