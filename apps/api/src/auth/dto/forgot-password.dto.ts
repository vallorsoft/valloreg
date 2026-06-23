import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { SUPPORTED_LOCALES } from '@valloreg/shared';

/** Jelszó-visszaállítás kérése: a fiók e-mail címe (+ opcionális nyelv az e-mailhez). */
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES as unknown as string[])
  locale?: string;
}
