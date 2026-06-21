import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ItemCategory, ItemType, PartType } from '@valloreg/shared';

const CATEGORY_VALUES = Object.values(ItemCategory);
const TYPE_VALUES = Object.values(ItemType);
const PART_TYPE_VALUES = Object.values(PartType);

/**
 * Egy számlatétel felülbírálása a review során.
 *
 * Minden mező opcionális (részleges frissítés):
 *  - `vehicleId`: string = jármű hozzárendelése, `null` = hozzárendelés törlése,
 *    `undefined` (hiányzik) = változatlan.
 *  - `category` / `type` / `partType`: a shared string-unionokra korlátozva.
 */
export class UpdateInvoiceItemDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  vehicleId?: string | null;

  @IsOptional()
  @IsIn(CATEGORY_VALUES)
  category?: string;

  @IsOptional()
  @IsIn(TYPE_VALUES)
  type?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(PART_TYPE_VALUES)
  partType?: string | null;
}
