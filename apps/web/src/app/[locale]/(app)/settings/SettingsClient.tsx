'use client';

import { useTranslations } from 'next-intl';
import { PageHeading } from '@/components/app/PageHeading';
import { TwoFactorCard } from '@/components/app/TwoFactorCard';

export function SettingsClient() {
  const t = useTranslations('settings');
  return (
    <div>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />
      <div className="max-w-2xl space-y-6">
        <TwoFactorCard />
      </div>
    </div>
  );
}
