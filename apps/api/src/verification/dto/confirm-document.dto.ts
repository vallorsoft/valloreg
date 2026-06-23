import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALL_COMPLIANCE_TYPES, type ComplianceType } from '@valloreg/shared';

class VerifyFileDto {
  @IsString()
  @MaxLength(512)
  storageKey!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(128)
  mimeType!: string;

  @IsInt()
  @Min(0)
  sizeBytes!: number;
}

/** A megfelelőség-dokumentum beolvasás megerősítése. */
export class ConfirmDocumentDto {
  @IsIn(ALL_COMPLIANCE_TYPES as readonly string[])
  type!: ComplianceType;

  @IsISO8601()
  validUntil!: string;

  @ValidateNested()
  @Type(() => VerifyFileDto)
  file!: VerifyFileDto;
}
