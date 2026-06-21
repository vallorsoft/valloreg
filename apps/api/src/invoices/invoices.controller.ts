import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InvoicesService } from './invoices.service';
import { AppException } from '../common/exceptions/app.exception';

@Controller('invoices')
@UseGuards(JwtAuthGuard, TenantGuard)
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

  // TODO (Fázis 3): POST /invoices/:id/confirm – review jóváhagyás.
  // TODO (Fázis 3): PATCH /invoices/:id/items – tétel-módosítás.
}
