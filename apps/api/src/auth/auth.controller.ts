import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  AuthenticatedRequest,
  AuthUser,
} from '../common/types/request-context';
import { AppConfigService } from '../config/app-config.service';
import { AppException } from '../common/exceptions/app.exception';
import { AuthService } from './auth.service';
import type { AuthResult, AuthTokens } from './auth.service';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './auth-cookie';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/** A kliensnek visszaadott auth-válasz: NINCS benne refresh token (az cookie-ban). */
type AuthResponseBody = Omit<AuthResult, keyof AuthTokens> & {
  accessToken: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const result = await this.authService.register(dto, req.ip);
    return this.respondWithAuth(res, result, dto.rememberMe ?? true);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const result = await this.authService.login(dto, req.ip);
    return this.respondWithAuth(res, result, dto.rememberMe ?? true);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = readRefreshCookie(req);
    if (!token) {
      throw AppException.tokenInvalid();
    }
    const result = await this.authService.refresh(token);
    this.setRefresh(res, result.refreshToken, result.remember);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readRefreshCookie(req);
    if (token) {
      await this.authService.logout(token);
    }
    clearRefreshCookie(res, this.config.refreshCookie);
  }

  /** Jelszó-visszaállítás kérése (mindig 200, nem árulja el a fiók létezését). */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.locale);
  }

  /** Új jelszó beállítása a visszaállító tokennel. */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }

  // ── Belső segédek ───────────────────────────────────────────────────────

  /** A refresh tokent httpOnly cookie-ba teszi, és a body-ból kihagyja. */
  private respondWithAuth(
    res: Response,
    result: AuthResult,
    remember: boolean,
  ): AuthResponseBody {
    this.setRefresh(res, result.refreshToken, remember);
    const { refreshToken: _omit, ...body } = result;
    return body;
  }

  /** A refresh cookie beállítása: "Remember me" → tartós, különben session. */
  private setRefresh(res: Response, token: string, remember: boolean): void {
    const maxAgeMs = remember ? this.config.jwt.refreshTtl * 1000 : undefined;
    setRefreshCookie(res, token, this.config.refreshCookie, maxAgeMs);
  }
}
