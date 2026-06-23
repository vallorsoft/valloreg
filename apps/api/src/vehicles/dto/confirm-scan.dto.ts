import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateVehicleDto } from './create-vehicle.dto';

/** Egy beolvasott (staging) fájl hivatkozása, amit a járműhöz kötünk. */
export class ScanFileRefDto {
  @IsString()
  @MaxLength(512)
  storageKey!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(128)
  mimeType!: string;

  @IsInt()
  @Min(0)
  sizeBytes!: number;
}

/**
 * A forgalmi-beolvasás megerősítése: a felhasználó által ellenőrzött jármű-mezők
 * (CreateVehicleDto: műszaki adatok + felek) + a beolvasott fájl(ok) hivatkozása.
 * `vehicleId` megadva = meglévő jármű frissítése (duplikátum esetén), különben új.
 */
export class ConfirmScanDto extends CreateVehicleDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanFileRefDto)
  files?: ScanFileRefDto[];
}
