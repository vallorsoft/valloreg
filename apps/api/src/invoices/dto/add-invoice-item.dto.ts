import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ItemCategory, ItemType, PartType } from '@valloreg/shared';

const CATEGORY_VALUES = Object.values(ItemCategory);
const TYPE_VALUES = Object.values(ItemType);
const PART_TYPE_VALUES = Object.values(PartType);

/**
 * Kézi számlatétel hozzáadása a review során – tipikusan MUNKADÍJ, amit az AI
 * nem olvasott ki a számláról, de a felhasználó rögzíteni akar (összeggel,
 * járműhöz köthetően). Általános is: bármilyen kategóriájú tétel felvehető.
 *
 * Alapértelmezések a service-ben: category = `labor`, type = `vehicle`,
 * quantity = 1. A `price` a tétel teljes összege (a riportok ezt összegzik).
 */
export class AddInvoiceItemDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  /** A tétel teljes összege (pl. a munkadíj). */
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  price!: number;

  /** Tétel-kategória; alapból `labor` (munkadíj). */
  @IsOptional()
  @IsIn(CATEGORY_VALUES)
  category?: string;

  /** Tétel-típus; alapból `vehicle` (járműhöz rendelhető). */
  @IsOptional()
  @IsIn(TYPE_VALUES)
  type?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(PART_TYPE_VALUES)
  partType?: string | null;

  /** Opcionális jármű-hozzárendelés. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  vehicleId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}
