import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import {
  ALL_FEATURE_KEYS,
  FeatureKey,
  PLAN_LIMITS,
  PlanTier,
} from '@valloreg/shared';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../prisma/tenant-context.service';
import { MailerService } from '../storage/mailer.service';
import { ReportsService } from './reports.service';

const REPORTS_QUEUE = 'reports';
const MONTHLY_JOB = 'monthly-report';

/**
 * Havi riport-ütemező: minden hónap elsején e-mailt küld a cég tulajdonosának
 * az ELŐZŐ hónap költség-összegzéséről. A MEGLÉVŐ riportot használja
 * (ReportsService) – NEM könyvelő-export és NEM integráció.
 *
 * Háttérben fut (nincs request-kontextus), ezért a tenant-scope-ot a
 * TenantContextService.runWith()-tel állítjuk be, így a ReportsService scoped
 * lekérdezései a megfelelő cégre szűrnek.
 */
@Injectable()
export class ReportsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsScheduler.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly mailer: MailerService,
    private readonly reports: ReportsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = this.config.redis;

    this.queue = new Queue(REPORTS_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });

    // Minden hónap 1-jén 08:00-kor.
    await this.queue.add(
      MONTHLY_JOB,
      {},
      { repeat: { pattern: '0 8 1 * *' }, jobId: 'reports-monthly' },
    );

    this.worker = new Worker(
      REPORTS_QUEUE,
      async () => this.sendMonthlyReports(),
      { connection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Havi riport-küldés sikertelen (${job?.id}): ${err.message}`,
        err.stack,
      );
    });

    this.logger.log('Havi riport-ütemező elindult (1-jén 08:00).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /** Az előző naptári hónap riportját küldi minden jogosult cég tulajdonosának. */
  async sendMonthlyReports(now: Date = new Date()): Promise<{ sent: number }> {
    const { from, to, label } = previousMonthRange(now);

    // Minden cég (system kliens) – a feature-t cégenként számoljuk.
    const tenants = await this.prisma.system.tenant.findMany({
      select: { id: true },
    });

    let sent = 0;
    for (const tenant of tenants) {
      try {
        if (!(await this.tenantHasReports(tenant.id))) continue;

        const owner = await this.prisma.system.membership.findFirst({
          where: { tenantId: tenant.id, role: 'OWNER' },
          include: { user: { select: { id: true, email: true } } },
        });
        if (!owner?.user?.email) continue;

        // A riportot a tenant-scope-ban számoljuk (a ReportsService scoped).
        const summary = await this.tenantContext.runWith(
          { tenantId: tenant.id, userId: owner.user.id, role: 'OWNER' },
          () => this.reports.getSummary(from, to),
        );

        if (summary.totals.invoiceCount === 0) continue;

        await this.mailer.send({
          to: owner.user.email,
          subject: `[Valloreg] Havi költség-összegzés – ${label}`,
          text: buildEmailText(label, summary),
        });
        sent++;
      } catch (err) {
        this.logger.warn(
          `Havi riport kihagyva (tenant ${tenant.id}): ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Havi riport-küldés kész: ${sent} cég értesítve (${label}).`);
    return { sent };
  }

  /** Igaz, ha a cég effektív feature-jei közt szerepel a REPORTS. */
  private async tenantHasReports(tenantId: string): Promise<boolean> {
    const [subscription, overrides] = await Promise.all([
      this.prisma.system.subscription.findUnique({
        where: { tenantId },
        select: { planTier: true },
      }),
      this.prisma.system.featureFlagOverride.findMany({
        where: { tenantId },
        select: { key: true, enabled: true },
      }),
    ]);
    const planTier = (subscription?.planTier ?? PlanTier.STARTER) as PlanTier;
    const features = new Set<string>(PLAN_LIMITS[planTier].features);
    for (const o of overrides) {
      if (!(ALL_FEATURE_KEYS as readonly string[]).includes(o.key)) continue;
      if (o.enabled) features.add(o.key);
      else features.delete(o.key);
    }
    return features.has(FeatureKey.REPORTS);
  }
}

/** Az előző naptári hónap [from, to] tartománya ISO dátumként + címke. */
function previousMonthRange(now: Date): {
  from: string;
  to: string;
  label: string;
} {
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(
    firstOfThisMonth.getFullYear(),
    firstOfThisMonth.getMonth() - 1,
    1,
  );
  const end = new Date(firstOfThisMonth.getTime() - 1); // előző hónap utolsó napja
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  return { from: iso(start), to: iso(end), label };
}

function buildEmailText(
  label: string,
  summary: { totals: { grossTotal: string; invoiceCount: number; currency: string | null } },
): string {
  const cur = summary.totals.currency ?? '';
  return [
    `Havi költség-összegzés – ${label}`,
    '',
    `Számlák száma: ${summary.totals.invoiceCount}`,
    `Bruttó összeg: ${summary.totals.grossTotal} ${cur}`.trim(),
    '',
    'Részletek a Valloreg felület Riportok oldalán.',
  ].join('\n');
}
