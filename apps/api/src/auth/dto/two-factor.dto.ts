import { IsString, Length, MaxLength, MinLength } from 'class-validator';

/** 2FA megerősítése a beállításkor (a generált titok + az app kódja). */
export class ConfirmTwoFactorDto {
  @IsString()
  @MinLength(1)
  secret!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

/** 2FA bejelentkezés második lépése (login challenge token + kód). */
export class VerifyTwoFactorLoginDto {
  @IsString()
  @MinLength(1)
  sessionToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

/** 2FA kikapcsolása jelszó-megerősítéssel. */
export class DisableTwoFactorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
