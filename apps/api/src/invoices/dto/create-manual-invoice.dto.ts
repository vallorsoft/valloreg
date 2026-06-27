import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ItemCategory, ItemType, PartType } from '@valloreg/shared';

const CATEGORY_VALUES = Object.values(ItemCategory);
const TYPE_VALUES = Object.values(ItemType);
const PART_TYPE_VALUES = Object.values(PartType);

/**
 * Egy kézi számla/„javítás" tétele. Az alkatrész és a munkadíj KÜLÖN tételként
 * vihető be (a `category`/`type` különbözteti meg): pl. alkatrész =
 * category `part` + type `vehicle`; munkadíj = category `labor` + type
 * `vehicle`. Ami hiányzik, opcionális.
 */
export class ManualInvoiceItemDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  /** Tétel-kategória (part, labor, service…). Alapból `part`. */
  @IsOptional()
  @IsIn(CATEGORY_VALUES)
  category?: string;

  /** Tétel-típus (vehicle, tool, general). Alapból `vehicle`. */
  @IsOptional()
  @IsIn(TYPE_VALUES)
  type?: string;

  /** Alkatrész-típus (fék, motor…), ha releváns. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(PART_TYPE_VALUES)
  partType?: string | null;

  /** Cikkszám/cikkkód, ha van (alkatrésznél). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  articleNumber?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;

  /** Egységár. Ha nincs megadva, a `price`-ból és a mennyiségből számoljuk. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  unitPrice?: number;

  /** A tétel teljes összege. Ha nincs megadva, `unitPrice * quantity`. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  price?: number;
}

/**
 * Kézi javítás-/költségrögzítés SZÁMLA NÉLKÜL. Olyan javításokhoz, amikhez nem
 * érkezik számla (pl. helyben, készpénzes munka). A backend egy „manuális"
 * Document + Invoice + tételek rekordot hoz létre (CONFIRMED állapotban, fájl
 * nélkül), így a szerviztörténet, a riportok és a TCO automatikusan tartalmazzák.
 */
export class CreateManualInvoiceDto {
  /** A javításhoz tartozó jármű (opcionális, de javításnál tipikusan kötelező). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  vehicleId?: string | null;

  /** ISO dátum (YYYY-MM-DD). Ha hiányzik, a mai nap. */
  @IsOptional()
  @IsISO8601()
  date?: string;

  /** A rekord megjelenített címe (a kliens lokalizált felirata); ez lesz a fájlnév. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /** Beszállító/szerelő neve (opcionális). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;

  /** Számlaszám/hivatkozás (opcionális). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  /** Pénznem (pl. RON). Alapból RON. */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  /** Kilométeróra-állás a javításkor (opcionális). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  odometerKm?: number;

  /** A tételek (alkatrész + munkadíj külön sorokban). Legalább egy. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ManualInvoiceItemDto)
  items!: ManualInvoiceItemDto[];
}
