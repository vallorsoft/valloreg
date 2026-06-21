import { Injectable } from '@nestjs/common';
import { DocumentStatus } from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardStats {
  vehicles: { total: number };
  documents: {
    total: number;
    thisMonth: number;
    needsReview: number;
    processing: number;
    confirmed: number;
  };
  invoices: {
    grossTotal: string | null;
    count: number;
  };
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const PROCESSING_STATUSES = [
      DocumentStatus.QUEUED,
      DocumentStatus.OCR_RUNNING,
      DocumentStatus.EXTRACTING,
    ];
    const CONFIRMED_STATUSES = [DocumentStatus.CONFIRMED, DocumentStatus.AUTO_OK];

    const [
      vehicleCount,
      documentTotal,
      documentThisMonth,
      documentNeedsReview,
      documentProcessing,
      documentConfirmed,
      invoiceAgg,
    ] = await Promise.all([
      this.prisma.scoped.vehicle.count(),
      this.prisma.scoped.document.count(),
      this.prisma.scoped.document.count({
        where: { createdAt: { gte: monthStart } },
      }),
      this.prisma.scoped.document.count({
        where: { status: DocumentStatus.NEEDS_REVIEW },
      }),
      this.prisma.scoped.document.count({
        where: { status: { in: PROCESSING_STATUSES } },
      }),
      this.prisma.scoped.document.count({
        where: { status: { in: CONFIRMED_STATUSES } },
      }),
      this.prisma.scoped.invoice.aggregate({
        _sum: { grossTotal: true },
        _count: true,
      }),
    ]);

    return {
      vehicles: { total: vehicleCount },
      documents: {
        total: documentTotal,
        thisMonth: documentThisMonth,
        needsReview: documentNeedsReview,
        processing: documentProcessing,
        confirmed: documentConfirmed,
      },
      invoices: {
        grossTotal: invoiceAgg._sum.grossTotal?.toString() ?? null,
        count: invoiceAgg._count,
      },
    };
  }
}
