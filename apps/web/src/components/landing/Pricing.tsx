import { useTranslations } from 'next-intl';
import {
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_CURRENCY,
  PlanTier,
  STORAGE_ADDONS,
  UNLIMITED,
} from '@valloreg/shared';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { SectionHeading } from './SectionHeading';
import { cn } from '@/lib/cn';

// Megjelenített sávok (3): Start · Pro · Fleet. A „Pro" a kiemelt, ajánlott csomag.
const PLAN_ORDER: PlanTier[] = [
  PlanTier.START,
  PlanTier.PRO,
  PlanTier.FLEET,
];

const HIGHLIGHTED: PlanTier = PlanTier.PRO;

const BYTES_PER_GB = 1024 * 1024 * 1024;

export function Pricing() {
  const t = useTranslations('landing.pricing');

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-anthracite-500">
          {t('transferNote')}
        </p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
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
            const storage = t('storage', {
              count: Math.round(limits.maxStorageBytes / BYTES_PER_GB),
            });

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
                  <li className="flex items-center gap-2">
                    <Check /> {storage}
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

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <h3 className="text-lg font-bold text-anthracite-900">
            {t('addonsTitle')}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-anthracite-500">
            {t('addonsNote')}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {STORAGE_ADDONS.map((addon) => (
              <span
                key={addon.extraGB}
                className="rounded-full border border-anthracite-200 bg-white px-4 py-2 text-sm font-medium text-anthracite-700"
              >
                {t('addonItem', { gb: addon.extraGB, price: addon.pricePerMonth })}
              </span>
            ))}
          </div>
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
