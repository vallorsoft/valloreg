import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ALL_MAJOR_COMPONENTS,
  MajorEventKind,
} from '@valloreg/shared';

const COMPONENT_VALUES = ALL_MAJOR_COMPONENTS as readonly string[];
const KIND_VALUES = Object.values(MajorEventKind);

/**
 * Nagy alkatrész esemény létrehozása. Kétféleképp:
 *  - kézzel: component + költségek (partsCost/laborCost) közvetlenül,
 *  - „felújítás-összerakás": `itemIds` megadásával a service a megadott
 *    számlatételek árát összegzi alkatrész-költségként (ha a partsCost nincs
 *    explicit megadva), és átveszi a számla pénznemét/dátumát.
 */
export class CreateMajorComponentEventDto {
  @IsIn(COMPONENT_VALUES)
  component!: string;

  @IsOptional()
  @IsIn(KIND_VALUES)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  odometerKm?: number;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  partsCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  laborCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  /** Forrás-számla (ha egy számlából jött / abból raktuk össze). */
  @IsOptional()
  @IsString()
  invoiceId?: string;

  /** „Felújítás-összerakás": mely számlatételekből áll össze az esemény. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
