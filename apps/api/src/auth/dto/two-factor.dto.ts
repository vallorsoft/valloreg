import { IsString, Length, Matches } from 'class-validator';

/** 2FA aktiválás/kikapcsolás: a felhasználó által beírt 6-jegyű TOTP kód. */
export class TwoFactorDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'A 2FA kód 6 számjegy.' })
  code!: string;
}
