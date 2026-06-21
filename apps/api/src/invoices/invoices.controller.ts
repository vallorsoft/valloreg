import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { AppException } from '../common/exceptions/app.exception';

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

  /** Tétel felülbírálása (jármű-hozzárendelés, kategória, típus). */
  @Patch('items/:itemId')
  @Roles(
    TenantRole.OWNER,
    TenantRole.FLEET_MANAGER,
    TenantRole.ADMIN,
    TenantRole.ACCOUNTANT,
  )
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
}
