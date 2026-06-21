import { useTranslations } from 'next-intl';
import { SectionHeading } from './SectionHeading';

// Placeholder figures – purely illustrative for the marketing mockup.
const STATS = [
  { key: 'monthlyCost', value: '1 248 000' },
  { key: 'yearlyCost', value: '14 760 000' },
  { key: 'costPerVehicle', value: '312 000' },
  { key: 'upcoming', value: '3' },
] as const;

export function DashboardPreview() {
  const t = useTranslations('landing.preview');

  return (
    <section className="bg-light py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-12 rounded-2xl border border-anthracite-100 bg-white p-6 shadow-card-hover sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.key}
                className="rounded-xl border border-anthracite-100 bg-light p-5"
              >
                <p className="text-sm font-medium text-anthracite-500">
                  {t(`stats.${stat.key}`)}
                </p>
                <p className="mt-2 text-2xl font-bold text-anthracite-900">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          {/* Decorative chart placeholder */}
          <div
            aria-hidden="true"
            className="mt-6 flex h-40 items-end gap-2 rounded-xl border border-anthracite-100 bg-light p-4"
          >
            {[40, 65, 50, 80, 60, 90, 75, 55, 70, 85, 45, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary-300"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-anthracite-500">
            {t('note')}
          </p>
        </div>
      </div>
    </section>
  );
}
