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
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { VerificationService } from '../verification/verification.service';
import { ConfirmDocumentDto } from '../verification/dto/confirm-document.dto';
import type { ComplianceType } from '@valloreg/shared';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ConfirmScanDto } from './dto/confirm-scan.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly verification: VerificationService,
  ) {}

  /** RO megfelelőség-ellenőrzés (ITP/RCA/rovinietă) most – frissíti az emlékeztetőket. */
  @Post(':id/verify')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  verify(
    @Param('id') id: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
  ) {
    return this.verification.verify(tenant.tenantId, user.userId, id);
  }

  /** A legutóbbi megfelelőség-ellenőrzés eredménye. */
  @Get(':id/verification')
  getVerification(@Param('id') id: string) {
    return this.verification.getLatest(id);
  }

  /** ITP/RCA/rovinietă igazolás beolvasása (OCR) – a lejáratot adja vissza. */
  @Post(':id/verify-document')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  verifyDocument(
    @CurrentTenant() tenant: ActiveTenant,
    @Param('id') id: string,
    @Query('type') type: ComplianceType,
    @UploadedFile() file: UploadedScanFile | undefined,
  ) {
    return this.verification.scanDocument(tenant.tenantId, type, file);
  }

  /** A beolvasott megfelelőségi lejárat mentése (emlékeztető + archívum). */
  @Post(':id/verify-document/confirm')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  confirmDocument(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ConfirmDocumentDto,
  ) {
    return this.verification.confirmDocument(
      tenant.tenantId,
      user.userId,
      id,
      dto.type,
      dto.validUntil,
      dto.file,
    );
  }

  /**
   * Forgalmi engedély beolvasásának INDÍTÁSA (1–2 kép vagy PDF). A fájl(oka)t
   * stagingbe tölti és háttér-feldolgozásra sorba teszi (OCR + AI), majd AZONNAL
   * visszaadja a `scanId`-t. A kliens a `GET scan/:scanId`-del pollingol az
   * eredményre – így a hosszú OCR+AI nem a HTTP-kérés idejét terheli.
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
    return this.vehiclesService.startScan(
      tenant.tenantId,
      user.userId,
      files,
      locale,
    );
  }

  /** Egy beolvasás (job) állapota és – ha kész – az eredménye (polling). */
  @Get('scan/:scanId')
  @RequireFeature(FeatureKey.AI_PROCESSING)
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  getScan(@Param('scanId') scanId: string) {
    return this.vehiclesService.getScan(scanId);
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

  /** CSV tömeges import – előnézet (soronkénti validáció, NEM ír). */
  @Post('import/preview')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  importPreview(@UploadedFile() file: UploadedScanFile | undefined) {
    return this.vehiclesService.previewImport(file);
  }

  /** CSV tömeges import – véglegesítés (létrehoz/frissít). */
  @Post('import/commit')
  @Roles(TenantRole.OWNER, TenantRole.FLEET_MANAGER, TenantRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  importCommit(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedScanFile | undefined,
  ) {
    return this.vehiclesService.commitImport(tenant.tenantId, user.userId, file);
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
