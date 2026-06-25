import { IsInt, IsPositive } from 'class-validator';

/**
 * Extra tárhely igénylése (utalásos). A `bytes` egy STORAGE_PACKS csomag mérete;
 * az árat a szerver a csomagból veszi (nem a kliensből), így nem hamisítható.
 */
export class RequestStorageDto {
  @IsInt()
  @IsPositive()
  bytes!: number;
}
