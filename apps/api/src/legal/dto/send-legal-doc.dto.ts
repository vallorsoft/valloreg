import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { LEGAL_DOWNLOAD_FORMATS, type LegalDownloadFormat } from '@valloreg/shared';

/** Egy dokumentum elküldése egy cégnek e-mailben, csatolt fájlként. */
export class SendLegalDocDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @IsIn([...LEGAL_DOWNLOAD_FORMATS])
  format!: LegalDownloadFormat;
}
