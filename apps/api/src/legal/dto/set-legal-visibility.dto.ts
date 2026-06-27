import { IsBoolean } from 'class-validator';

/** Publikus láthatóság kapcsolása (közzététel / visszavonás). */
export class SetLegalVisibilityDto {
  @IsBoolean()
  isPublic!: boolean;
}
