import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Platform-szintű számla-/utalási adatok (csak Super Admin). Minden mező
 * opcionális; az üresen hagyott mezők az env-tartalékra esnek vissza.
 */
export class SetBillingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  beneficiary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  swift?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notifyEmail?: string;
}
