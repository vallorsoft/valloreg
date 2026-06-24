import { useTranslations } from 'next-intl';
import { PLAN_LIMITS, PlanTier, UNLIMITED } from '@valloreg/shared';
import { SectionHeading } from './SectionHeading';

const GB = 1024 * 1024 * 1024;

// A landing három csomagja, sorrendben (Start / Pro / Fleet).
const COLS: PlanTier[] = [
  PlanTier.STARTER,
  PlanTier.STANDARD,
  PlanTier.PROFESSIONAL,
];

// Funkció-sorok: i18n kulcs + elérhetőség csomagonként (Start/Pro/Fleet).
const FEATURE_ROWS: { key: string; on: [boolean, boolean, boolean] }[] = [
  { key: 'ocrAi', on: [true, true, true] },
  { key: 'serviceBook', on: [true, true, true] },
  { key: 'dashboard', on: [true, true, true] },
  { key: 'reports', on: [false, true, true] },
  { key: 'reminders', on: [false, true, true] },
  { key: 'majorParts', on: [false, true, true] },
  { key: 'insights', on: [false, false, true] },
  { key: 'durability', on: [false, false, true] },
  { key: 'rankings', on: [false, false, true] },
  { key: 'supplier', on: [false, false, true] },
  { key: 'extraStorage', on: [true, true, true] },
];

export function PlanComparison() {
  const t = useTranslations('landing.compare');
  const tp = useTranslations('landing.pricing');
  // A tipizált fordító nem fogad sablon-kulcsot; a dinamikus kulcsokhoz casteljük.
  const tr = t as unknown as (k: string) => string;
  const tpr = tp as unknown as (k: string) => string;

  const limitValue = (tier: PlanTier, kind: 'vehicles' | 'users' | 'documents' | 'storage') => {
    const l = PLAN_LIMITS[tier];
    if (kind === 'storage') return `${Math.round(l.maxStorageBytes / GB)} GB`;
    const v =
      kind === 'vehicles'
        ? l.maxVehicles
        : kind === 'users'
          ? l.maxUsers
          : l.maxDocumentsPerMonth;
    return v === UNLIMITED ? '∞' : String(v);
  };

  return (
    <section id="compare" className="scroll-mt-20 bg-anthracite-50 py-20">
      <div className="container-page">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-anthracite-200">
                <th className="px-4 py-3 font-semibold text-anthracite-700">
                  {t('feature')}
                </th>
                {COLS.map((tier) => (
                  <th
                    key={tier}
                    className={
                      'px-4 py-3 text-center font-bold ' +
                      (tier === PlanTier.STANDARD
                        ? 'text-primary-700'
                        : 'text-anthracite-900')
                    }
                  >
                    {tpr(`plans.${tier}.name`)}
                    {tier === PlanTier.STANDARD && (
                      <span className="ml-1 align-middle text-[10px] font-semibold uppercase text-primary-600">
                        ★
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {/* Limit-sorok */}
              {(['vehicles', 'users', 'documents', 'storage'] as const).map((kind) => (
                <tr key={kind}>
                  <td className="px-4 py-3 font-medium text-anthracite-800">
                    {tr(`limits.${kind}`)}
                  </td>
                  {COLS.map((tier) => (
                    <td key={tier} className="px-4 py-3 text-center text-anthracite-700">
                      {limitValue(tier, kind)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Funkció-sorok */}
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-3 font-medium text-anthracite-800">
                    {tr(`rows.${row.key}`)}
                  </td>
                  {row.on.map((on, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {on ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                          ✓
                        </span>
                      ) : (
                        <span className="text-anthracite-300">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-anthracite-500">{t('note')}</p>
      </div>
    </section>
  );
}
