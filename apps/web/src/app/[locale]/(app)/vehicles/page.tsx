import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { PhaseNote } from '@/components/app/PhaseNote';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vehicles' });
  return { title: t('title') };
}

const COLUMNS = [
  'plate',
  'make',
  'model',
  'year',
  'odometer',
  'cost',
  'actions',
] as const;

function VehiclesContent() {
  const t = useTranslations('vehicles');

  return (
    <>
      <PageHeading
        title={t('title')}
        subtitle={t('subtitle')}
        action={<Button>{t('addVehicle')}</Button>}
      />
      <PhaseNote />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                  >
                    {t(`table.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16">
                  <div className="mx-auto max-w-sm text-center">
                    <h2 className="text-base font-semibold text-anthracite-900">
                      {t('empty.title')}
                    </h2>
                    <p className="mt-1 text-sm text-anthracite-500">
                      {t('empty.description')}
                    </p>
                    <Button className="mt-4" variant="outline">
                      {t('empty.cta')}
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export default async function VehiclesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VehiclesContent />;
}
