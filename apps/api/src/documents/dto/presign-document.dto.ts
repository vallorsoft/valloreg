import { IsString, MaxLength, MinLength } from 'class-validator';

export class PresignDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  mimeType!: string;
}
