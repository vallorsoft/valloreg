import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FeatureKey, MAX_DOCUMENT_SIZE_BYTES, TenantRole } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  ActiveTenant,
  AuthUser,
} from '../common/types/request-context';
import { DocumentsService } from './documents.service';
import type { UploadedDocumentFile } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Dokumentum feltöltése EGY kéréssel (multipart/form-data, `file` mező).
   * A fájl az API-n keresztül kerül az objektumtárba (szerveroldali feltöltés),
   * így nincs böngésző→S3 CORS / presigned URL / kliens-checksum függőség.
   */
  @Post()
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  upload(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedDocumentFile | undefined,
  ) {
    return this.documentsService.upload(tenant.tenantId, user.userId, file);
  }

  /** Lista (minden tag). */
  @Get()
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  list() {
    return this.documentsService.list();
  }

  /** Részletek a számlával (ha van). */
  @Get(':id')
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  get(@Param('id') id: string) {
    return this.documentsService.getById(id);
  }

  /** Presigned GET URL letöltéshez. */
  @Get(':id/download')
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  download(@Param('id') id: string) {
    return this.documentsService.getDownloadUrl(id);
  }

  /** Dokumentum jóváhagyása (AUTO_OK | NEEDS_REVIEW → CONFIRMED). */
  @Patch(':id/confirm')
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  @Roles(
    TenantRole.OWNER,
    TenantRole.FLEET_MANAGER,
    TenantRole.ADMIN,
    TenantRole.ACCOUNTANT,
  )
  confirm(
    @Param('id') id: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.confirm(tenant.tenantId, user.userId, id);
  }
}
