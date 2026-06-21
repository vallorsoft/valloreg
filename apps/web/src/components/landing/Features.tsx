import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from './SectionHeading';

// Maps directly to the shared FeatureKey set (OCR, AI, multi-vehicle, service
// book, dashboard, multi-tenant) as required by the spec.
const FEATURES = [
  'ocr',
  'ai',
  'multiVehicle',
  'serviceBook',
  'dashboard',
  'multiTenant',
] as const;

export function Features() {
  const t = useTranslations('landing.features');

  return (
    <section id="features" className="scroll-mt-20 bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((key) => (
            <Card key={key} hoverable>
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700"
              >
                <span className="h-3 w-3 rounded-sm bg-primary-600" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-anthracite-900">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-anthracite-600">
                {t(`items.${key}.description`)}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
