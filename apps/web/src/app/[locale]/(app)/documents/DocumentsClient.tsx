'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { DocumentStatus } from '@valloreg/shared';
import { documentsApi, ApiError, type DocumentListItem } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageHeading } from '@/components/app/PageHeading';
import { UploadZone } from '@/components/app/UploadZone';
import { DocumentStatusBadge } from '@/components/app/DocumentStatusBadge';

const PROCESSING = new Set<string>([
  DocumentStatus.QUEUED,
  DocumentStatus.OCR_RUNNING,
  DocumentStatus.EXTRACTING,
]);

export function DocumentsClient() {
  const t = useTranslations('documents');
  const locale = useLocale();
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await documentsApi.list());
    } catch {
      // 401 → AppShell redirect kezeli
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // 5 másodpercenként frissít, ha van feldolgozás alatt lévő dokumentum.
  useEffect(() => {
    if (!docs.some((d) => PROCESSING.has(d.status))) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [docs, refresh]);

  function handleUploadComplete(doc: DocumentListItem) {
    setDocs((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
    void refresh();
  }

  async function handleDelete(doc: DocumentListItem) {
    if (!window.confirm(t('actions.confirmDelete'))) return;
    setError(null);
    setDeletingId(doc.id);
    try {
      await documentsApi.remove(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('actions.deleteError'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />
      <UploadZone onUploadComplete={handleUploadComplete} />

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <Card className="mt-6 overflow-hidden p-0">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-anthracite-500">
            {t('loading')}
          </div>
        ) : docs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-semibold text-anthracite-900">{t('empty.title')}</p>
            <p className="mt-1 text-sm text-anthracite-500">{t('empty.description')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('table.name')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('table.uploadedAt')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('table.status')}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-anthracite-100">
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="cursor-pointer hover:bg-anthracite-50"
                    onClick={() => router.push(`/${locale}/documents/${doc.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-anthracite-900">
                      {doc.fileName}
                    </td>
                    <td className="px-4 py-3 text-anthracite-500">
                      {new Date(doc.createdAt).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-3">
                      <DocumentStatusBadge status={doc.status as DocumentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          className="text-sm text-primary-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${locale}/documents/${doc.id}`);
                          }}
                        >
                          {t('table.view')}
                        </button>
                        <button
                          className="text-sm text-red-500 hover:underline disabled:opacity-50"
                          disabled={deletingId === doc.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(doc);
                          }}
                        >
                          {deletingId === doc.id
                            ? t('actions.deleting')
                            : t('actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
