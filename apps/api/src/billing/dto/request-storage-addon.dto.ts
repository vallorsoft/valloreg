import { IsInt } from 'class-validator';

export class RequestStorageAddonDto {
  /** A kért extra tárhely GB-ban (érvényes opciók: 5, 10, 25). */
  @IsInt({ message: 'Érvénytelen extra tárhely érték.' })
  extraGB!: number;
}
