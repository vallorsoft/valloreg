'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SectionHeading } from './SectionHeading';
import { cn } from '@/lib/cn';

const ITEMS = [
  'fileTypes',
  'accuracy',
  'security',
  'languages',
  'cancel',
] as const;

export function Faq() {
  const t = useTranslations('landing.faq');
  const [openItem, setOpenItem] = useState<string | null>(ITEMS[0]);

  return (
    <section id="faq" className="scroll-mt-20 bg-light py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {ITEMS.map((key) => {
            const isOpen = openItem === key;
            const panelId = `faq-panel-${key}`;
            const buttonId = `faq-button-${key}`;
            return (
              <div
                key={key}
                className="overflow-hidden rounded-xl border border-anthracite-100 bg-white"
              >
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenItem(isOpen ? null : key)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-anthracite-900 hover:bg-anthracite-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {t(`items.${key}.question`)}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'text-primary-600 transition-transform',
                        isOpen && 'rotate-45',
                      )}
                    >
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="px-5 pb-4 text-sm text-anthracite-600"
                >
                  {t(`items.${key}.answer`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
