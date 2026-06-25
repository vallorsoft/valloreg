import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { DEFAULT_LOCALE, PlanTier, TenantRole } from '@valloreg/shared';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { MailerService } from '../storage/mailer.service';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Regisztráció: User + Tenant + Membership(OWNER) + Subscription(START,
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
            planTier: PlanTier.START,
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
   * Jelszó-visszaállítás KÉRÉSE. Mindig sikerrel tér vissza (nem áruljuk el,
   * létezik-e a fiók – email-enumeráció ellen). Ha a felhasználó létezik,
   * egyszer használatos tokent generál (hash-elve tároljuk), és emailt küld a
   * visszaállító linkkel.
   */
  async forgotPassword(email: string, locale?: string): Promise<{ ok: true }> {
    const normalized = email.toLowerCase().trim();

    const user = await this.prisma.system.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true },
    });

    if (user) {
      // A korábbi, még fel nem használt tokeneket érvénytelenítjük.
      await this.prisma.system.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      const expiresAt = new Date(
        Date.now() + this.config.passwordResetTtl * 1000,
      );

      await this.prisma.system.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      await this.sendResetEmail(user.email, rawToken, locale);

      await this.audit.log({
        userId: user.id,
        action: 'auth.password_reset_requested',
        resourceType: 'User',
        resourceId: user.id,
      });
    } else {
      // Ismeretlen cím: ugyanúgy viselkedünk (időzítés/válasz), csak logolunk.
      this.logger.debug(
        `Jelszó-visszaállítás ismeretlen címre: ${normalized}`,
      );
    }

    return { ok: true };
  }

  /**
   * Jelszó beállítása a visszaállító tokennel. Validálja a tokent (létezik, nem
   * használt, nem járt le), frissíti a jelszót, a tokent használtnak jelöli, és
   * BIZTONSÁGBÓL visszavonja a felhasználó összes refresh tokenjét.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const tokenHash = this.hashToken(token);

    const record = await this.prisma.system.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!record || record.usedAt) {
      throw AppException.tokenInvalid();
    }
    if (record.expiresAt < new Date()) {
      throw AppException.tokenExpired();
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.system.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      // Minden aktív munkamenet érvénytelenítése (kijelentkeztetés mindenhol).
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.log({
      userId: record.userId,
      action: 'auth.password_reset',
      resourceType: 'User',
      resourceId: record.userId,
    });

    return { ok: true };
  }

  /** A visszaállító e-mail összeállítása és kiküldése a megadott nyelven. */
  private async sendResetEmail(
    to: string,
    rawToken: string,
    locale?: string,
  ): Promise<void> {
    const lang = (locale ?? DEFAULT_LOCALE).toLowerCase();
    const link = `${this.config.webAppUrl}/${lang}/reset-password?token=${rawToken}`;
    const minutes = Math.round(this.config.passwordResetTtl / 60);

    const t = RESET_EMAIL_I18N[lang] ?? RESET_EMAIL_I18N[DEFAULT_LOCALE]!;
    const text = t.text(link, minutes);

    await this.mailer.send({
      to,
      subject: t.subject,
      text,
      html: t.html(link, minutes),
    });
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

/** Jelszó-visszaállító e-mail szövegek nyelvenként (hu/ro/en). */
interface ResetEmailTemplate {
  subject: string;
  text: (link: string, minutes: number) => string;
  html: (link: string, minutes: number) => string;
}

const RESET_EMAIL_I18N: Record<string, ResetEmailTemplate> = {
  hu: {
    subject: 'Jelszó visszaállítása – Valloreg',
    text: (link, minutes) =>
      `Jelszó-visszaállítást kértél a Valloreg fiókodhoz.\n\n` +
      `Állítsd be az új jelszavad ezen a linken (${minutes} percig érvényes):\n${link}\n\n` +
      `Ha nem te kérted, hagyd figyelmen kívül ezt az e-mailt – a jelszavad változatlan marad.`,
    html: (link, minutes) =>
      `<p>Jelszó-visszaállítást kértél a <strong>Valloreg</strong> fiókodhoz.</p>` +
      `<p><a href="${link}">Kattints ide az új jelszó beállításához</a> (a link ${minutes} percig érvényes).</p>` +
      `<p>Ha nem te kérted, hagyd figyelmen kívül ezt az e-mailt – a jelszavad változatlan marad.</p>`,
  },
  ro: {
    subject: 'Resetare parolă – Valloreg',
    text: (link, minutes) =>
      `Ai solicitat resetarea parolei pentru contul tău Valloreg.\n\n` +
      `Setează o parolă nouă folosind acest link (valabil ${minutes} de minute):\n${link}\n\n` +
      `Dacă nu ai solicitat tu, ignoră acest e-mail – parola rămâne neschimbată.`,
    html: (link, minutes) =>
      `<p>Ai solicitat resetarea parolei pentru contul tău <strong>Valloreg</strong>.</p>` +
      `<p><a href="${link}">Apasă aici pentru a seta o parolă nouă</a> (linkul este valabil ${minutes} de minute).</p>` +
      `<p>Dacă nu ai solicitat tu, ignoră acest e-mail – parola rămâne neschimbată.</p>`,
  },
  en: {
    subject: 'Password reset – Valloreg',
    text: (link, minutes) =>
      `You requested a password reset for your Valloreg account.\n\n` +
      `Set a new password using this link (valid for ${minutes} minutes):\n${link}\n\n` +
      `If you didn't request this, ignore this email – your password stays unchanged.`,
    html: (link, minutes) =>
      `<p>You requested a password reset for your <strong>Valloreg</strong> account.</p>` +
      `<p><a href="${link}">Click here to set a new password</a> (the link is valid for ${minutes} minutes).</p>` +
      `<p>If you didn't request this, ignore this email – your password stays unchanged.</p>`,
  },
};
