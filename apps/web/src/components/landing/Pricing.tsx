import { useTranslations } from 'next-intl';
import {
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_CURRENCY,
  PlanTier,
  UNLIMITED,
} from '@valloreg/shared';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { SectionHeading } from './SectionHeading';
import { cn } from '@/lib/cn';

// Display order; PROFESSIONAL is highlighted as the recommended plan.
const PLAN_ORDER: PlanTier[] = [
  PlanTier.STARTER,
  PlanTier.STANDARD,
  PlanTier.PROFESSIONAL,
  PlanTier.BUSINESS,
];

const HIGHLIGHTED: PlanTier = PlanTier.PROFESSIONAL;

export function Pricing() {
  const t = useTranslations('landing.pricing');

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-anthracite-500">
          {t('transferNote')}
        </p>
        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {PLAN_ORDER.map((tier) => {
            const limits = PLAN_LIMITS[tier];
            const highlighted = tier === HIGHLIGHTED;

            const vehicles =
              limits.maxVehicles === UNLIMITED
                ? t('vehiclesUnlimited')
                : t('vehicles', { count: limits.maxVehicles });
            const users =
              limits.maxUsers === UNLIMITED
                ? t('usersUnlimited')
                : t('users', { count: limits.maxUsers });
            const documents =
              limits.maxDocumentsPerMonth === UNLIMITED
                ? t('documentsUnlimited')
                : t('documents', { count: limits.maxDocumentsPerMonth });

            return (
              <Card
                key={tier}
                className={cn(
                  'relative flex flex-col',
                  highlighted &&
                    'border-primary-500 ring-2 ring-primary-500',
                )}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-semibold text-white">
                    {t('mostPopular')}
                  </span>
                )}
                <h3 className="text-xl font-bold text-anthracite-900">
                  {t(`plans.${tier}.name`)}
                </h3>
                <p className="mt-2 min-h-[3rem] text-sm text-anthracite-600">
                  {t(`plans.${tier}.description`)}
                </p>

                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-anthracite-900">
                    {PLAN_PRICES[tier].toLocaleString('hu-HU')} {PLAN_CURRENCY}
                  </span>
                  <span className="text-sm text-anthracite-400">{t('perMonth')}</span>
                </p>
                <p className="mt-1 text-xs font-medium text-primary-700">
                  {t('freeTrial')}
                </p>

                <ul className="mt-6 flex-1 space-y-3 text-sm text-anthracite-700">
                  <li className="flex items-center gap-2">
                    <Check /> {vehicles}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check /> {users}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check /> {documents}
                  </li>
                </ul>

                <Link href="/register" className="mt-6">
                  <Button
                    fullWidth
                    variant={highlighted ? 'primary' : 'outline'}
                  >
                    {t('cta')}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700"
    >
      ✓
    </span>
  );
}
