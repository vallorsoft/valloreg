import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VehiclePartyRole, VehiclePartyType } from '@valloreg/shared';

/**
 * Egy jármű-fél (tulajdonos vagy üzembentartó/lízingbevevő). A `partyType` dönti
 * el, hogy az `idNumber` CNP (magánszemély) vagy CUI (cég). Minden mező a
 * megerősítés előtt szabadon szerkeszthető a kliensen.
 */
export class VehiclePartyDto {
  @IsIn([VehiclePartyRole.OWNER, VehiclePartyRole.USER])
  role!: VehiclePartyRole;

  @IsOptional()
  @IsIn([VehiclePartyType.PERSON, VehiclePartyType.COMPANY])
  partyType?: VehiclePartyType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string;

  /** CNP (magánszemély) vagy CUI/adószám (cég). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idNumber?: string;
}
