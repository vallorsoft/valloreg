import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { ALL_FLEET_SEGMENTS } from '@valloreg/shared';

const SEGMENT_VALUES = ALL_FLEET_SEGMENTS as readonly string[];

/** Kézi tartósság-felülírás: szegmens + fődarab → várható élettartam (km). */
export class SetDurabilityBaselineDto {
  @IsIn(SEGMENT_VALUES)
  segment!: string;

  @IsString()
  component!: string;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  expectedKm!: number;
}
