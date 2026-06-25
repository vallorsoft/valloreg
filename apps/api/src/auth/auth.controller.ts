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
import {
  ConfirmTwoFactorDto,
  DisableTwoFactorDto,
  VerifyTwoFactorLoginDto,
} from './dto/two-factor.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: AuthenticatedRequest) {
    return this.authService.register(dto, req.ip);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest) {
    return this.authService.login(dto, req.ip);
  }

  @Public()
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

  // ── 2FA (TOTP) ──────────────────────────────────────────────────────────

  /** 2FA bekapcsolásának indítása: titok + otpauth URI (még nem tárolt). */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  beginTwoFactorSetup(@CurrentUser() user: AuthUser) {
    return this.authService.beginTwoFactorSetup(user.userId);
  }

  /** 2FA megerősítése: titok + kód → a titok tárolása. */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  confirmTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmTwoFactorDto,
  ) {
    return this.authService.confirmTwoFactorSetup(
      user.userId,
      dto.secret,
      dto.code,
    );
  }

  /** 2FA kikapcsolása jelszó-megerősítéssel. */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableTwoFactorDto,
  ) {
    return this.authService.disableTwoFactor(user.userId, dto.password);
  }

  /** 2FA bejelentkezés második lépése (challenge token + kód). */
  @Public()
  @Post('2fa/verify-login')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactorLogin(
    @Body() dto: VerifyTwoFactorLoginDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.verifyTwoFactorLogin(
      dto.sessionToken,
      dto.code,
      req.ip,
    );
  }
}
