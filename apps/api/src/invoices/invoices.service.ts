import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/**
 * Számla olvasás. Az Invoice/InvoiceItem tenant-scope-olt; a scoped kliens szűr.
 *
 * Fázis 3 (TODO): review/confirm – a NEEDS_REVIEW állapotú számlák jóváhagyása,
 * tételszintű módosítás, jármű-hozzárendelés, majd Document → CONFIRMED. A tanuló
 * mappingek (SupplierVehicleMapping, ItemCategoryMapping) frissítése is ide jön.
 */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Egy számla a tételeivel, dokumentum-azonosító alapján. */
  async getByDocumentId(documentId: string) {
    const invoice = await this.prisma.scoped.invoice.findFirst({
      where: { documentId },
      include: { items: true, supplier: true },
    });
    if (!invoice) {
      throw AppException.notFound(
        'Ehhez a dokumentumhoz még nincs feldolgozott számla.',
      );
    }
    return invoice;
  }

  /** Egy számla a tételeivel, számla-azonosító alapján. */
  async getById(invoiceId: string) {
    const invoice = await this.prisma.scoped.invoice.findFirst({
      where: { id: invoiceId },
      include: { items: true, supplier: true },
    });
    if (!invoice) {
      throw AppException.notFound('A számla nem található.');
    }
    return invoice;
  }

  // TODO (Fázis 3): confirm(invoiceId, dto) – review jóváhagyás + tétel/jármű
  // módosítás + Document CONFIRMED + tanuló mapping frissítés.
  // TODO (Fázis 3): updateItems(invoiceId, items) – tételenkénti felülbírálás.
}
