import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from './SectionHeading';

const ITEMS = ['first', 'second', 'third'] as const;

export function Testimonials() {
  const t = useTranslations('landing.testimonials');

  return (
    <section className="bg-light py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {ITEMS.map((key) => (
            <Card key={key} className="flex flex-col">
              <blockquote className="flex-1 text-anthracite-700">
                “{t(`items.${key}.quote`)}”
              </blockquote>
              <footer className="mt-6 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="brand-gradient flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                >
                  {t(`items.${key}.author`).charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-anthracite-900">
                    {t(`items.${key}.author`)}
                  </p>
                  <p className="text-xs text-anthracite-500">
                    {t(`items.${key}.role`)}
                  </p>
                </div>
              </footer>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
