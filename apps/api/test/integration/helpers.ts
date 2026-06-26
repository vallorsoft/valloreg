import { randomUUID } from 'node:crypto';
import { TenantRole } from '@valloreg/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  TenantContext,
  TenantContextService,
} from '../../src/prisma/tenant-context.service';

/**
 * Integrációs teszt-segédek. ÉLŐ Postgres + generált @prisma/client kell hozzájuk
 * (a CI futtatja: `prisma generate` + `migrate deploy`). Minden a `prisma.system`
 * (nem scope-olt) kliensen keresztül seedel/töröl, mert a setup során még nincs
 * tenant kontextus.
 */

export interface SeededTenant {
  tenantId: string;
  userId: string;
  role: TenantRole;
}

/**
 * Létrehoz egy `TenantContextService`-t és egy `PrismaService`-t. NEM csatlakozik –
 * a hívó dolga `await prisma.onModuleInit()`-tel connectelni.
 */
export function makePrisma(): { prisma: PrismaService; ctx: TenantContextService } {
  const ctx = new TenantContextService();
  const prisma = new PrismaService(ctx);
  return { prisma, ctx };
}

/**
 * Seedel egy izolált tenantot + usert + membershipet a megadott szerepkörrel.
 * Random emaillel, hogy a párhuzamos/ismételt CI-futás se ütközzön.
 * A `prisma.system` (nem scope-olt) kliensen megy, mert még nincs tenant kontextus.
 */
export async function seedTenant(
  prisma: PrismaService,
  role: TenantRole,
): Promise<SeededTenant> {
  const tenant = await prisma.system.tenant.create({
    data: { name: `IT tenant ${randomUUID()}` },
  });

  const user = await prisma.system.user.create({
    data: {
      email: `it-${randomUUID()}@example.test`,
      passwordHash: 'x',
    },
  });

  await prisma.system.membership.create({
    data: { tenantId: tenant.id, userId: user.id, role },
  });

  return { tenantId: tenant.id, userId: user.id, role };
}

/**
 * Takarítás a teszt végén: törli a megadott tenant-eket és user-eket a
 * `prisma.system`-en. A Membership/Vehicle/stb. CASCADE törlődik a tenanttel és
 * a userrel együtt (lásd a séma `onDelete: Cascade` relációit).
 */
export async function cleanup(
  prisma: PrismaService,
  ids: { tenantIds?: string[]; userIds?: string[] },
): Promise<void> {
  const tenantIds = ids.tenantIds ?? [];
  const userIds = ids.userIds ?? [];

  if (tenantIds.length > 0) {
    await prisma.system.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }
  if (userIds.length > 0) {
    await prisma.system.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

export type { TenantContext };
