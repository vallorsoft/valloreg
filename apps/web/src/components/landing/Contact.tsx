'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from './SectionHeading';

/**
 * Contact form skeleton. Submission is a no-op for Phase 1 — wiring to the
 * backend (or an email service) lands in a later phase.
 */
export function Contact() {
  const t = useTranslations('landing.contact');

  return (
    <section id="contact" className="scroll-mt-20 bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <Card className="mx-auto mt-12 max-w-2xl">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              // TODO (later phase): submit to API / email service.
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                name="name"
                label={t('name')}
                placeholder={t('namePlaceholder')}
                autoComplete="name"
              />
              <Input
                name="email"
                type="email"
                label={t('email')}
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
              />
            </div>
            <Input
              name="company"
              label={t('company')}
              placeholder={t('companyPlaceholder')}
              autoComplete="organization"
            />
            <div className="space-y-1.5">
              <label
                htmlFor="contact-message"
                className="block text-sm font-medium text-anthracite-700"
              >
                {t('message')}
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder={t('messagePlaceholder')}
                className="w-full rounded-xl border border-anthracite-200 bg-white px-3.5 py-2.5 text-sm text-anthracite-900 placeholder:text-anthracite-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
              />
            </div>
            <Button type="submit" size="lg">
              {t('submit')}
            </Button>
            <p className="text-xs text-anthracite-500">{t('note')}</p>
          </form>
        </Card>
      </div>
    </section>
  );
}
