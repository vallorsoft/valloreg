import { useTranslations } from 'next-intl';
import { SectionHeading } from './SectionHeading';

const STEPS = ['upload', 'extract', 'review', 'history'] as const;

export function Solution() {
  const t = useTranslations('landing.solution');

  return (
    <section className="bg-light py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((key, index) => (
            <li
              key={key}
              className="relative rounded-2xl border border-anthracite-100 bg-white p-6 shadow-card"
            >
              <span
                aria-hidden="true"
                className="brand-gradient flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold text-anthracite-900">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-anthracite-600">
                {t(`steps.${key}.description`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
