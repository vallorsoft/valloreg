import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'A jelszó legalább 8 karakter legyen.' })
  @MaxLength(128)
  password!: string;

  /** "Remember me" (tartós vs. session refresh cookie). Alap: igaz. */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
