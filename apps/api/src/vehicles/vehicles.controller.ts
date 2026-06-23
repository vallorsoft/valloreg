import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
import { VehiclesService } from './vehicles.service';
import type { UploadedScanFile } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ConfirmScanDto } from './dto/confirm-scan.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  /**
   * Forgalmi engedély beolvasása (1–2 kép vagy PDF). OCR + AI kiolvasás, NEM ment
   * járművet – a draft mezőket adja vissza ellenőrzésre. AI_PROCESSING feature mögött.
   */
  @Post('scan')
  @RequireFeature(FeatureKey.AI_PROCESSING)
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @UseInterceptors(
    FilesInterceptor('files', 2, { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  scan(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: UploadedScanFile[] | undefined,
    @Query('locale') locale?: string,
  ) {
    return this.vehiclesService.scanRegistration(
      tenant.tenantId,
      user.userId,
      files,
      locale,
    );
  }

  /** A beolvasott (ellenőrzött) adatok mentése: új jármű vagy meglévő frissítése. */
  @Post('scan/confirm')
  @RequireFeature(FeatureKey.AI_PROCESSING)
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  confirmScan(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmScanDto,
  ) {
    return this.vehiclesService.confirmScan(tenant.tenantId, user.userId, dto);
  }

  /** Egy jármű csatolt dokumentumai (archívum). */
  @Get(':id/documents')
  listDocuments(@Param('id') id: string) {
    return this.vehiclesService.listDocuments(id);
  }

  /** Presigned letöltési URL egy jármű-dokumentumhoz. */
  @Get(':id/documents/:docId/download')
  downloadDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.vehiclesService.getDocumentDownloadUrl(id, docId);
  }

  /** Lista – minden tag (VIEWER is). */
  @Get()
  list() {
    return this.vehiclesService.list();
  }

  /** Részletek – minden tag. */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.vehiclesService.getById(id);
  }

  /** Szerviztörténet (hozzárendelt tételek + összegzés) – minden tag. */
  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.vehiclesService.getServiceHistory(id);
  }

  /** Létrehozás – OWNER, FLEET_MANAGER, ADMIN. */
  @Post()
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  create(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.create(tenant.tenantId, user.userId, dto);
  }

  /** Módosítás – OWNER, FLEET_MANAGER, ADMIN. */
  @Patch(':id')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  update(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(tenant.tenantId, user.userId, id, dto);
  }

  /** Törlés – OWNER, FLEET_MANAGER, ADMIN. */
  @Delete(':id')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.vehiclesService.remove(tenant.tenantId, user.userId, id);
  }
}
