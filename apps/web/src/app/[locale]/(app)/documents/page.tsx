import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { DocumentStatus } from '@valloreg/shared';
import { Card } from '@/components/ui/Card';
import { PageHeading } from '@/components/app/PageHeading';
import { PhaseNote } from '@/components/app/PhaseNote';
import { UploadZone } from '@/components/app/UploadZone';
import { DocumentStatusBadge } from '@/components/app/DocumentStatusBadge';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'documents' });
  return { title: t('title') };
}

// Placeholder rows – demonstrate the status badges across a few states.
const SAMPLE_DOCS = [
  { id: '1', name: 'szamla-2026-0142.pdf', uploadedAt: '2026-06-18', status: DocumentStatus.CONFIRMED },
  { id: '2', name: 'mol-szerviz-0098.pdf', uploadedAt: '2026-06-19', status: DocumentStatus.NEEDS_REVIEW },
  { id: '3', name: 'gumis-foto.jpg', uploadedAt: '2026-06-20', status: DocumentStatus.OCR_RUNNING },
  { id: '4', name: 'olajcsere.png', uploadedAt: '2026-06-20', status: DocumentStatus.FAILED },
] as const;

function DocumentsContent() {
  const t = useTranslations('documents');

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />
      <PhaseNote />

      <UploadZone />

      <Card className="mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('table.name')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('table.uploadedAt')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('table.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {SAMPLE_DOCS.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3 font-medium text-anthracite-900">
                    {doc.name}
                  </td>
                  <td className="px-4 py-3 text-anthracite-500">
                    {doc.uploadedAt}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocumentsContent />;
}
