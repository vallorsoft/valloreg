import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  /**
   * "Remember me": ha igaz, a refresh cookie TARTÓS (a böngésző újraindítását is
   * túléli); ha hamis, SESSION cookie (bezáráskor törlődik). Alap: igaz.
   */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
