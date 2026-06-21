import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from './SectionHeading';

const ITEMS = ['scattered', 'manual', 'noInsight'] as const;

export function Problem() {
  const t = useTranslations('landing.problem');

  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ITEMS.map((key) => (
            <Card key={key}>
              <h3 className="text-lg font-semibold text-anthracite-900">
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
