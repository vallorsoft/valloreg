import { useTranslations } from 'next-intl';
import { SectionHeading } from './SectionHeading';

const BENEFITS = ['time', 'accuracy', 'transparency', 'scalable'] as const;

export function Benefits() {
  const t = useTranslations('landing.benefits');

  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {BENEFITS.map((key) => (
            <div key={key} className="flex gap-4">
              <span
                aria-hidden="true"
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white"
              >
                ✓
              </span>
              <div>
                <h3 className="font-semibold text-anthracite-900">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-1 text-sm text-anthracite-600">
                  {t(`items.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
