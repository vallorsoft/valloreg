import { useTranslations } from 'next-intl';

/** Small banner reminding that real data wiring lands in later phases. */
export function PhaseNote() {
  const t = useTranslations('app');
  return (
    <div className="mb-6 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800">
      {t('phaseNote')}
    </div>
  );
}
