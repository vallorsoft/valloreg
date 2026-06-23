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
import { ALL_REMINDER_TYPES, ReminderKind } from '@valloreg/shared';

const KINDS = Object.values(ReminderKind);

/** Emlékeztető módosítása. Minden mező opcionális (részleges frissítés). */
export class UpdateReminderDto {
  @IsOptional()
  @IsIn(KINDS)
  kind?: string;

  @IsOptional()
  @IsIn(ALL_REMINDER_TYPES as readonly string[])
  type?: string;

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
