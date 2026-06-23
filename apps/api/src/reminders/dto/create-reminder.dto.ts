import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ALL_REMINDER_TYPES,
  ReminderKind,
  type ReminderType,
} from '@valloreg/shared';

const KINDS = Object.values(ReminderKind);

/**
 * Emlékeztető létrehozása. A `kind`/`type` a shared string-union értékekre van
 * korlátozva. Idő- és/vagy km-alapú esedékesség (legalább az egyik ajánlott –
 * ezt a service ellenőrzi, hogy lokalizált AppException-t adhasson).
 */
export class CreateReminderDto {
  @IsString()
  vehicleId!: string;

  @IsIn(KINDS)
  kind!: string;

  @IsIn(ALL_REMINDER_TYPES as readonly string[])
  type!: ReminderType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  dueOdometerKm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  intervalDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  intervalKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
