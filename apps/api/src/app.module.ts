import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
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
import { AdminModule } from './admin/admin.module';
import { LegalModule } from './legal/legal.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RemindersModule } from './reminders/reminders.module';
import { InsightsModule } from './insights/insights.module';
import { VerificationModule } from './verification/verification.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { DsrModule } from './dsr/dsr.module';
import { DataRetentionModule } from './data-retention/data-retention.module';
import { MajorComponentsModule } from './major-components/major-components.module';
import { RankingsModule } from './rankings/rankings.module';

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
    NotificationsModule,

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
    AdminModule,
    LegalModule,
    BillingModule,
    RemindersModule,
    InsightsModule,
    VerificationModule,
    BenchmarkModule,
    DsrModule,
    DataRetentionModule,
    MajorComponentsModule,
    RankingsModule,
  ],
})
export class AppModule implements NestModule {
  /**
   * A tenant-kontextus middleware MINDEN útvonalra fut, így minden kérés egy
   * megnyitott ALS scope-ban dolgozik. A TenantGuard ezt tölti fel; a system
   * (unscoped) útvonalakat (auth, health) nem érinti – ott csak üres marad.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*path');
  }
}
