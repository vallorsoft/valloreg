import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { OcrModule } from './ocr/ocr.module';
import { ExtractionModule } from './extraction/extraction.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DocumentsModule } from './documents/documents.module';
import { InvoicesModule } from './invoices/invoices.module';
import { HealthModule } from './health/health.module';
import { StatsModule } from './stats/stats.module';
import { ReportsModule } from './reports/reports.module';

/**
 * Gyökér modul. A globális modulok (config, prisma, audit, storage,
 * feature-flags) bárhonnan elérhetők; a domain modulok ezekre épülnek.
 */
@Module({
  imports: [
    // Infrastruktúra (globális)
    AppConfigModule,
    PrismaModule,
    AuditModule,
    StorageModule,
    FeatureFlagsModule,

    // Feldolgozó pipeline
    OcrModule,
    ExtractionModule,
    QueueModule,

    // Domain
    AuthModule,
    TenantsModule,
    UsersModule,
    VehiclesModule,
    DocumentsModule,
    InvoicesModule,
    HealthModule,
    StatsModule,
    ReportsModule,
  ],
})
export class AppModule {}
