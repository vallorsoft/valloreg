import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import {
  DEFAULT_LOCALE,
  isWithinLimit,
  PLAN_LIMITS,
  PlanTier,
  TenantRole,
  TENANT_ROLE_RANK,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { MailerService } from '../storage/mailer.service';
import { AppException } from '../common/exceptions/app.exception';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { AcceptInviteDto } from './dto/accept-invite.dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
    private readonly config: AppConfigService,
  ) {}

  /** Az aktív cég tagjai (membership + felhasználó). Tenant-scope-olt olvasás. */
  async listMembers(tenantId: string) {
    // A Membership scope-olt, de a felhasználó adatát is mutatjuk: a relációs
    // include a scope-on belül marad (a where tenantId-t a kiterjesztés adja).
    const memberships = await this.prisma.scoped.membership.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    void tenantId;
    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      user: m.user,
      createdAt: m.createdAt,
    }));
  }

  /**
   * Felhasználó meghívása. Ellenőrzi a csomag user-limitjét (tagok + függőben
   * lévő meghívók), létrehoz egy Invitation rekordot, és emailt küld (stub).
   */
  async invite(
    tenantId: string,
    inviterUserId: string,
    inviterRole: TenantRole,
    dto: InviteUserDto,
  ) {
    // Jogosultság-eszkaláció ellen: ne lehessen a sajátnál magasabb (vagy OWNER)
    // szerepkörre meghívni.
    this.assertCanAssignRole(inviterRole, dto.role);
    await this.assertUserLimit(tenantId);

    const email = dto.email.toLowerCase().trim();

    // Már tag? (system kliens: a user globális, de a membership scope-olt.)
    const existingUser = await this.prisma.system.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      const alreadyMember = await this.prisma.system.membership.findUnique({
        where: {
          tenantId_userId: { tenantId, userId: existingUser.id },
        },
        select: { id: true },
      });
      if (alreadyMember) {
        throw AppException.validation('Ez a felhasználó már a cég tagja.');
      }
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.scoped.invitation.create({
      // tenantId-t a scoped kliens is injektálja; explicit a típusbiztonságért.
      data: {
        tenantId,
        email,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    // A meghívó-link a web-app accept-invite oldalára mutat (a jelszó-visszaállító
    // e-mail link-felépítését tükrözve: webAppUrl + locale + útvonal + token).
    const lang = DEFAULT_LOCALE.toLowerCase();
    const acceptLink = `${this.config.webAppUrl}/${lang}/accept-invite?token=${token}`;

    await this.mailer.send({
      to: email,
      subject: 'Meghívó – Valloreg',
      text:
        `Meghívást kaptál egy Valloreg céghez.\n` +
        `Fogadd el a meghívót ezen a linken: ${acceptLink}\n` +
        `(Vagy add meg ezt a tokent kézzel: ${token})\n` +
        `Lejárat: ${expiresAt.toISOString()}`,
    });

    await this.audit.log({
      tenantId,
      userId: inviterUserId,
      action: 'user.invited',
      resourceType: 'Invitation',
      resourceId: invitation.id,
      metadata: { email, role: dto.role },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Meghívó elfogadása. NEM tenant-kontextusban fut (a felhasználó még nem tag),
   * ezért SYSTEM kliens + token-alapú feloldás. Ha a felhasználó nem létezik,
   * jelszóval létrehozza.
   */
  async acceptInvite(dto: AcceptInviteDto) {
    const invitation = await this.prisma.system.invitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation || invitation.acceptedAt) {
      throw AppException.notFound('A meghívó érvénytelen vagy már elfogadott.');
    }
    if (invitation.expiresAt < new Date()) {
      throw AppException.validation('A meghívó lejárt.');
    }

    // A cég user-limitjét elfogadáskor is ellenőrizzük.
    await this.assertUserLimit(invitation.tenantId);

    let user = await this.prisma.system.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      if (!dto.password) {
        throw AppException.validation(
          'Új fiókhoz jelszó megadása kötelező.',
        );
      }
      const passwordHash = await argon2.hash(dto.password);
      user = await this.prisma.system.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: dto.name ?? null,
        },
      });
    }

    await this.prisma.system.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user!.id,
          role: invitation.role,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    await this.audit.log({
      tenantId: invitation.tenantId,
      userId: user.id,
      action: 'user.invite_accepted',
      resourceType: 'Membership',
      metadata: { email: invitation.email, role: invitation.role },
    });

    return {
      tenantId: invitation.tenantId,
      userId: user.id,
      role: invitation.role,
    };
  }

  /** Függőben lévő (el nem fogadott, nem lejárt) meghívók listája. */
  async listInvitations(tenantId: string) {
    void tenantId; // a scope-olt kliens a tenantId-t maga injektálja
    return this.prisma.scoped.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  /** Függő meghívó visszavonása. */
  async revokeInvitation(
    tenantId: string,
    actorUserId: string,
    invitationId: string,
  ): Promise<void> {
    const invitation = await this.prisma.scoped.invitation.findFirst({
      where: { id: invitationId },
    });
    if (!invitation) {
      throw AppException.notFound('A meghívó nem található.');
    }
    if (invitation.acceptedAt) {
      throw AppException.validation('Egy elfogadott meghívó nem vonható vissza.');
    }

    await this.prisma.scoped.invitation.delete({ where: { id: invitationId } });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'user.invite_revoked',
      resourceType: 'Invitation',
      resourceId: invitationId,
      metadata: { email: invitation.email },
    });
  }

  /** Tag szerepkörének módosítása. */
  async changeMemberRole(
    tenantId: string,
    actorUserId: string,
    actorRole: TenantRole,
    membershipId: string,
    role: TenantRole,
  ) {
    const membership = await this.prisma.scoped.membership.findFirst({
      where: { id: membershipId },
    });
    if (!membership) {
      throw AppException.notFound('A tag nem található.');
    }

    // Jogosultság-eszkaláció ellen: csak a sajátnál nem magasabb rangú tagot
    // lehet kezelni, és csak a sajátnál nem magasabb (OWNER esetén csak OWNER)
    // szerepkört lehet adni.
    this.assertCanManageMember(actorRole, membership.role);
    this.assertCanAssignRole(actorRole, role);

    // Az utolsó OWNER nem fokozható le (cég ne maradjon tulajdonos nélkül).
    if (membership.role === TenantRole.OWNER && role !== TenantRole.OWNER) {
      await this.assertNotLastOwner(tenantId, membershipId);
    }

    const updated = await this.prisma.scoped.membership.update({
      where: { id: membershipId },
      data: { role },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'user.role_changed',
      resourceType: 'Membership',
      resourceId: membershipId,
      metadata: { newRole: role },
    });

    return { membershipId: updated.id, role: updated.role };
  }

  /** Tag eltávolítása a cégből. */
  async removeMember(
    tenantId: string,
    actorUserId: string,
    actorRole: TenantRole,
    membershipId: string,
  ): Promise<void> {
    const membership = await this.prisma.scoped.membership.findFirst({
      where: { id: membershipId },
    });
    if (!membership) {
      throw AppException.notFound('A tag nem található.');
    }

    // Jogosultság-eszkaláció ellen: nálad magasabb rangú (vagy OWNER) tagot nem
    // távolíthatsz el.
    this.assertCanManageMember(actorRole, membership.role);

    if (membership.role === TenantRole.OWNER) {
      await this.assertNotLastOwner(tenantId, membershipId);
    }

    await this.prisma.scoped.membership.delete({
      where: { id: membershipId },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'user.removed',
      resourceType: 'Membership',
      resourceId: membershipId,
    });
  }

  // ── Belső segédek ───────────────────────────────────────────────────────

  /**
   * Nem adható (meghívóval vagy módosítással) a sajátnál magasabb rangú
   * szerepkör, és OWNER szerepkört csak OWNER oszthat – jogosultság-eszkaláció
   * ellen (pl. ADMIN ne tehessen senkit, magát se, OWNER-ré).
   */
  private assertCanAssignRole(
    actorRole: TenantRole,
    targetRole: TenantRole,
  ): void {
    if (targetRole === TenantRole.OWNER && actorRole !== TenantRole.OWNER) {
      throw AppException.forbidden('Tulajdonosi szerepkört csak tulajdonos adhat.');
    }
    if (TENANT_ROLE_RANK[targetRole] > TENANT_ROLE_RANK[actorRole]) {
      throw AppException.forbidden(
        'Nem adhatsz a sajátodnál magasabb szerepkört.',
      );
    }
  }

  /**
   * Nem kezelhető (módosítható/törölhető) a sajátnál magasabb rangú tag, és
   * OWNER tagot csak OWNER kezelhet.
   */
  private assertCanManageMember(
    actorRole: TenantRole,
    memberRole: TenantRole,
  ): void {
    if (memberRole === TenantRole.OWNER && actorRole !== TenantRole.OWNER) {
      throw AppException.forbidden('Tulajdonost csak tulajdonos kezelhet.');
    }
    if (TENANT_ROLE_RANK[memberRole] > TENANT_ROLE_RANK[actorRole]) {
      throw AppException.forbidden(
        'Nem kezelhetsz a sajátodnál magasabb rangú tagot.',
      );
    }
  }

  /** Csomag user-limit ellenőrzése (aktív tagok + függő meghívók). */
  private async assertUserLimit(tenantId: string): Promise<void> {
    const subscription = await this.prisma.system.subscription.findUnique({
      where: { tenantId },
      select: { planTier: true },
    });
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const limit = PLAN_LIMITS[planTier].maxUsers;

    const [members, pendingInvites] = await Promise.all([
      this.prisma.system.membership.count({ where: { tenantId } }),
      this.prisma.system.invitation.count({
        where: { tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);

    if (!isWithinLimit(members + pendingInvites, limit)) {
      throw AppException.usersLimitReached();
    }
  }

  private async assertNotLastOwner(
    tenantId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const otherOwners = await this.prisma.system.membership.count({
      where: {
        tenantId,
        role: TenantRole.OWNER,
        id: { not: excludingMembershipId },
      },
    });
    if (otherOwners === 0) {
      throw AppException.validation(
        'A cég utolsó tulajdonosa nem távolítható el / fokozható le.',
      );
    }
  }
}
