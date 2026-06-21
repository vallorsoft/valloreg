import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PlanTier, TenantRole } from '@valloreg/shared';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/exceptions/app.exception';
import type { AccessTokenPayload } from './strategies/jwt.strategy';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const TRIAL_DAYS = 14;

export interface MembershipSummary {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    name: string | null;
    isPlatformAdmin: boolean;
  };
  memberships: MembershipSummary[];
}

/**
 * Auth szolgáltatás. MINDEN művelet a SYSTEM (unscoped) Prisma klienst használja,
 * mert a hitelesítés/regisztráció nem tenant-kontextusban fut.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Regisztráció: User + Tenant + Membership(OWNER) + Subscription(STARTER,
   * TRIALING, +14 nap) egy tranzakcióban. Visszaad tokeneket + cég infót.
   */
  async register(dto: RegisterDto, ip?: string): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.system.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw AppException.emailTaken();
    }

    const passwordHash = await argon2.hash(dto.password);
    const trialEndsAt = new Date(
      Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    );

    const { user, tenant } = await this.prisma.system.$transaction(
      async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: dto.contactName ?? null,
          },
        });

        const createdTenant = await tx.tenant.create({
          data: {
            name: dto.companyName,
            taxNumber: dto.taxNumber ?? null,
            contactName: dto.contactName ?? null,
            email,
            phone: dto.phone ?? null,
          },
        });

        await tx.membership.create({
          data: {
            tenantId: createdTenant.id,
            userId: createdUser.id,
            role: TenantRole.OWNER,
          },
        });

        await tx.subscription.create({
          data: {
            tenantId: createdTenant.id,
            planTier: PlanTier.STARTER,
            status: SubscriptionStatus.TRIALING,
            trialEndsAt,
          },
        });

        return { user: createdUser, tenant: createdTenant };
      },
    );

    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: 'auth.register',
      resourceType: 'Tenant',
      resourceId: tenant.id,
      ip,
    });

    const tokens = await this.issueTokens(user.id, user.email, user.isPlatformAdmin);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      memberships: [
        {
          tenantId: tenant.id,
          tenantName: tenant.name,
          role: TenantRole.OWNER,
        },
      ],
    };
  }

  /** Bejelentkezés: tokenek + a felhasználó membership-listája (aktív cég választáshoz). */
  async login(dto: LoginDto, ip?: string): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.system.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { tenant: { select: { name: true } } } },
      },
    });

    if (!user) {
      throw AppException.invalidCredentials();
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw AppException.invalidCredentials();
    }

    await this.audit.log({
      userId: user.id,
      action: 'auth.login',
      resourceType: 'User',
      resourceId: user.id,
      ip,
    });

    const tokens = await this.issueTokens(user.id, user.email, user.isPlatformAdmin);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      memberships: user.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: m.role,
      })),
    };
  }

  /**
   * Refresh token rotáció: a régi tokent visszavonja, újat ad ki.
   * A refresh token JWT-ként érkezik; a tárolt hash-t is ellenőrizzük.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch {
      throw AppException.tokenInvalid();
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.system.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw AppException.tokenExpired();
    }

    // Rotáció: a régi tokent visszavonjuk.
    await this.prisma.system.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.system.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isPlatformAdmin: true },
    });
    if (!user) {
      throw AppException.tokenInvalid();
    }

    return this.issueTokens(user.id, user.email, user.isPlatformAdmin);
  }

  /** Kijelentkezés: a megadott refresh token visszavonása. */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.system.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Aktuális felhasználó + membership-ek (a /auth/me-hez). */
  async me(userId: string): Promise<Omit<AuthResult, keyof AuthTokens>> {
    const user = await this.prisma.system.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { tenant: { select: { name: true } } } },
      },
    });

    if (!user) {
      throw AppException.unauthorized();
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPlatformAdmin: user.isPlatformAdmin,
      },
      memberships: user.memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
        role: m.role,
      })),
    };
  }

  // ── Belső segédek ───────────────────────────────────────────────────────

  private async issueTokens(
    userId: string,
    email: string,
    isPlatformAdmin: boolean,
  ): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: userId, email, isPlatformAdmin };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtl,
    });

    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomBytes(16).toString('hex') },
      {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshTtl,
      },
    );

    const expiresAt = new Date(
      Date.now() + this.config.jwt.refreshTtl * 1000,
    );
    await this.prisma.system.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
