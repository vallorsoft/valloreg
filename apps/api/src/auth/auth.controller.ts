import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  AuthenticatedRequest,
  AuthUser,
} from '../common/types/request-context';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorDto } from './dto/two-factor.dto';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit(10, 60_000)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: AuthenticatedRequest) {
    return this.authService.register(dto, req.ip);
  }

  @Public()
  @RateLimit(10, 60_000)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest) {
    return this.authService.login(dto, req.ip);
  }

  @Public()
  @RateLimit(30, 60_000)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /** Jelszó-visszaállítás kérése (mindig 200, nem árulja el a fiók létezését). */
  @Public()
  @RateLimit(5, 60_000)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.locale);
  }

  /** Új jelszó beállítása a visszaállító tokennel. */
  @Public()
  @RateLimit(10, 60_000)
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

  // ── Kétfaktoros hitelesítés (2FA / TOTP) ──────────────────────────────

  /** 2FA beállítás indítása: secret + otpauth URL a QR-kódhoz. */
  @UseGuards(JwtAuthGuard)
  @RateLimit(10, 60_000)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.authService.setupTwoFactor(user.userId);
  }

  /** 2FA aktiválása a setup-secrethez tartozó kód megerősítésével. */
  @UseGuards(JwtAuthGuard)
  @RateLimit(10, 60_000)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDto) {
    return this.authService.enableTwoFactor(user.userId, dto.code);
  }

  /** 2FA kikapcsolása érvényes kóddal. */
  @UseGuards(JwtAuthGuard)
  @RateLimit(10, 60_000)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  disableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDto) {
    return this.authService.disableTwoFactor(user.userId, dto.code);
  }
}
