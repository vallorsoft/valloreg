'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from './SectionHeading';

/**
 * Kapcsolatfelvételi űrlap. Nincs lead-fogadó backend-végpont, ezért a beküldés
 * a felhasználó levelezőprogramját nyitja meg (`mailto:`) a tárgy/törzs előre
 * kitöltésével – ez az őszinte, működő megoldás backend nélkül.
 */
export function Contact() {
  const t = useTranslations('landing.contact');
  const tc = useTranslations('common');
  const contactEmail = tc('contactEmail');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (message.trim().length === 0) {
      setError(t('errorNoMessage'));
      return;
    }

    const lines = [
      `${t('name')}: ${name.trim()}`,
      `${t('email')}: ${email.trim()}`,
      `${t('company')}: ${company.trim()}`,
      '',
      message.trim(),
    ];
    const subject = encodeURIComponent(t('mailtoSubject'));
    const body = encodeURIComponent(lines.join('\n'));
    // A levelezőprogram megnyitása az előre kitöltött üzenettel.
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <section id="contact" className="scroll-mt-20 bg-white py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <Card className="mx-auto mt-12 max-w-2xl">
          {sent ? (
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {t('success', { email: contactEmail })}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  name="name"
                  label={t('name')}
                  placeholder={t('namePlaceholder')}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  name="email"
                  type="email"
                  label={t('email')}
                  placeholder={t('emailPlaceholder')}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Input
                name="company"
                label={t('company')}
                placeholder={t('companyPlaceholder')}
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
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
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-anthracite-200 bg-white px-3.5 py-2.5 text-sm text-anthracite-900 placeholder:text-anthracite-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
                />
              </div>
              <Button type="submit" size="lg">
                {t('submit')}
              </Button>
              <p className="text-xs text-anthracite-500">{t('note')}</p>
            </form>
          )}
        </Card>
      </div>
    </section>
  );
}
