import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FeatureKey, TenantRole } from '@valloreg/shared';
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
import { PresignDocumentDto } from './dto/presign-document.dto';
import { RegisterDocumentDto } from './dto/register-document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** Presigned PUT URL kérése feltöltéshez. */
  @Post('presign')
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  presign(
    @CurrentTenant() tenant: ActiveTenant,
    @Body() dto: PresignDocumentDto,
  ) {
    return this.documentsService.presign(tenant.tenantId, dto);
  }

  /** Feltöltött dokumentum regisztrálása + feldolgozás sorbavétele. */
  @Post()
  @RequireFeature(FeatureKey.DOCUMENT_LIBRARY)
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  register(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDocumentDto,
  ) {
    return this.documentsService.register(tenant.tenantId, user.userId, dto);
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
