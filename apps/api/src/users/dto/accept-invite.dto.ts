import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  @MinLength(1)
  token!: string;

  /** Ha a felhasználó még nem létezik, jelszót kell megadnia a fiók létrehozásához. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
