import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
 * + a beolvasott fájl(ok) hivatkozása. `vehicleId` megadva = meglévő jármű
 * frissítése (duplikátum esetén), különben új jármű.
 */
export class ConfirmScanDto {
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  make?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScanFileRefDto)
  files?: ScanFileRefDto[];
}
