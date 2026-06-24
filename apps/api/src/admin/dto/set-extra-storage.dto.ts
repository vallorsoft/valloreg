import { IsInt, Max, Min } from 'class-validator';

/** Egy cég vásárolt extra tárhelye GB-ban (a Super Admin állítja utalás után). */
export class SetExtraStorageDto {
  @IsInt()
  @Min(0)
  @Max(10_000)
  gb!: number;
}
