import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Jogi dokumentum tartalmának szerkesztése (SuperAdmin). A `blocks` szerkezeti
 * validációja a service-ben történik a megosztott zod-sémával (`legalBlocksSchema`).
 */
export class UpdateLegalDocDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  summary!: string;

  @IsString()
  @IsNotEmpty()
  updated!: string;

  @IsArray()
  blocks!: unknown[];
}
