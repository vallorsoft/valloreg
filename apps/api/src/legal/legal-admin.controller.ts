import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { LEGAL_DOWNLOAD_FORMATS, type LegalDownloadFormat } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/request-context';
import { AppException } from '../common/exceptions/app.exception';
import { LegalService } from './legal.service';
import { UpdateLegalDocDto } from './dto/update-legal-doc.dto';
import { SetLegalVisibilityDto } from './dto/set-legal-visibility.dto';
import { SendLegalDocDto } from './dto/send-legal-doc.dto';

function parseFormat(value: string | undefined): LegalDownloadFormat {
  if ((LEGAL_DOWNLOAD_FORMATS as readonly string[]).includes(value ?? '')) {
    return value as LegalDownloadFormat;
  }
  throw AppException.validation('Ismeretlen letöltési formátum (md | json | pdf).');
}

/**
 * Super Admin (platform) jogi dokumentum-kezelés. Szerkesztés, publikálás
 * ki/be, letöltés (md/json/pdf) és cégnek küldés. Minden végpont
 * `isPlatformAdmin` jogot igényel; nincs tenant kontextus.
 */
@Controller('admin/legal')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class LegalAdminController {
  constructor(private readonly legal: LegalService) {}

  /** Minden dokumentum (publikus + belső) lista. */
  @Get()
  list() {
    return this.legal.listAll();
  }

  /** Egy dokumentum teljes tartalma (szerkesztéshez). */
  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.legal.getOne(slug);
  }

  /** Tartalom szerkesztése. */
  @Put(':slug')
  update(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLegalDocDto,
  ) {
    return this.legal.update(user.userId, slug, dto);
  }

  /** Publikus láthatóság kapcsolása (közzététel / visszavonás). */
  @Put(':slug/visibility')
  setVisibility(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetLegalVisibilityDto,
  ) {
    return this.legal.setVisibility(user.userId, slug, dto.isPublic);
  }

  /** Letöltés a kért formátumban (?format=md|json|pdf, alapért. pdf). */
  @Get(':slug/download')
  async download(
    @Param('slug') slug: string,
    @Query('format') format: string | undefined,
  ): Promise<StreamableFile> {
    const file = await this.legal.download(slug, parseFormat(format ?? 'pdf'));
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: `attachment; filename="${file.filename}"`,
    });
  }

  /** Elküldés egy cégnek e-mailben, csatolt fájlként. */
  @Post(':slug/send')
  send(@Param('slug') slug: string, @CurrentUser() user: AuthUser, @Body() dto: SendLegalDocDto) {
    return this.legal.sendToTenant(user.userId, slug, dto.tenantId, dto.format);
  }
}
