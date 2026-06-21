import { IsBoolean } from 'class-validator';

export class SetFeatureOverrideDto {
  @IsBoolean()
  enabled!: boolean;
}
