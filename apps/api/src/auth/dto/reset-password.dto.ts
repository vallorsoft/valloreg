import { IsString, MaxLength, MinLength } from 'class-validator';

/** Jelszó beállítása a visszaállító tokennel. */
export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(8, { message: 'A jelszónak legalább 8 karakterből kell állnia.' })
  @MaxLength(128)
  password!: string;
}
