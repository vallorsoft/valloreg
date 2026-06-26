import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Megerősítő jelszó a visszafordíthatatlan törlésekhez (fiók / cég).
 * A token-szivárgás miatti véletlen törlés ellen véd.
 */
export class DeleteConfirmDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
