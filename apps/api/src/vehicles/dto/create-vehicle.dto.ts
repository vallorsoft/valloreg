import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehiclePartyDto } from './vehicle-party.dto';

export class CreateVehicleDto {
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
  @IsString()
  @MaxLength(64)
  vehicleType?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  odometerKm?: number;

  // ── Forgalmiból kiolvasott bővített műszaki adatok ──────────────────────────
  /** Első forgalomba helyezés (ISO dátum, YYYY-MM-DD). */
  @IsOptional()
  @IsISO8601()
  firstRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  fuelType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  engineCm3?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  powerKw?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  seats?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  maxMassKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  kerbWeightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  euroClass?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  typeApproval?: string;

  // ── Tulajdonos (C.2) és üzembentartó / lízingbevevő (C.1) ───────────────────
  /** A jármű felei. Megadva FELÜLÍRJA a meglévő feleket (role szerint). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehiclePartyDto)
  parties?: VehiclePartyDto[];
}
