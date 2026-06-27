import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantRole } from '@valloreg/shared';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type {
  ActiveTenant,
  AuthUser,
} from '../common/types/request-context';
import { InvoicesService } from './invoices.service';
import { UpdateInvoiceItemDto } from './dto/update-invoice-item.dto';
import { AddInvoiceItemDto } from './dto/add-invoice-item.dto';
import { CreateManualInvoiceDto } from './dto/create-manual-invoice.dto';
import { AppException } from '../common/exceptions/app.exception';

const ITEM_EDIT_ROLES = [
  TenantRole.OWNER,
  TenantRole.FLEET_MANAGER,
  TenantRole.ADMIN,
  TenantRole.ACCOUNTANT,
] as const;

@Controller('invoices')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Számla lekérése. Vagy `?documentId=...` (dokumentumhoz), vagy `:id` (lent).
   */
  @Get()
  getByDocument(@Query('documentId') documentId?: string) {
    if (!documentId) {
      throw AppException.validation('A documentId query paraméter kötelező.');
    }
    return this.invoicesService.getByDocumentId(documentId);
  }

  /** Számla a tételeivel, számla-azonosító alapján. */
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.invoicesService.getById(id);
  }

  /**
   * KÉZI javítás rögzítése SZÁMLA NÉLKÜL: alkatrész és munkadíj külön tételként.
   * Olyan javításokhoz, amikhez nem érkezik számla. Egy „manuális" Document +
   * Invoice + tételek jön létre (CONFIRMED, fájl nélkül).
   */
  @Post('manual')
  @Roles(...ITEM_EDIT_ROLES)
  createManual(
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateManualInvoiceDto,
  ) {
    return this.invoicesService.createManual(tenant.tenantId, user.userId, dto);
  }

  /** Tétel felülbírálása (jármű-hozzárendelés, kategória, típus). */
  @Patch('items/:itemId')
  @Roles(...ITEM_EDIT_ROLES)
  updateItem(
    @Param('itemId') itemId: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateInvoiceItemDto,
  ) {
    return this.invoicesService.updateItem(
      tenant.tenantId,
      user.userId,
      itemId,
      dto,
    );
  }

  /** Kézi tétel (tipikusan munkadíj) hozzáadása egy számlához. */
  @Post(':invoiceId/items')
  @Roles(...ITEM_EDIT_ROLES)
  addItem(
    @Param('invoiceId') invoiceId: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.invoicesService.addItem(
      tenant.tenantId,
      user.userId,
      invoiceId,
      dto,
    );
  }

  /** Számlatétel törlése (kézi korrekció). */
  @Delete('items/:itemId')
  @Roles(...ITEM_EDIT_ROLES)
  deleteItem(
    @Param('itemId') itemId: string,
    @CurrentTenant() tenant: ActiveTenant,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoicesService.deleteItem(
      tenant.tenantId,
      user.userId,
      itemId,
    );
  }
}
