import {
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Egy már (presigned URL-lel) feltöltött dokumentum regisztrálása.
 * A storageKey-t a presign válaszából kapja vissza a kliens.
 */
export class RegisterDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  storageKey!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  sha256!: string;
}
