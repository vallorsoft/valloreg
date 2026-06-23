'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { vehiclesApi, type VehicleDocumentItem } from '@/lib/api';
import { Card } from '@/components/ui/Card';

/**
 * Egy jármű csatolt dokumentumai (pl. beolvasott forgalmi engedély). Ha nincs
 * dokumentum, a komponens nem jelenik meg.
 */
export function VehicleDocuments({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations('vehicles.documents');
  const locale = useLocale();
  const [docs, setDocs] = useState<VehicleDocumentItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setDocs(await vehiclesApi.listDocuments(vehicleId));
    } catch {
      // 403/401 → elrejtjük
    } finally {
      setLoaded(true);
    }
  }, [vehicleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function open(doc: VehicleDocumentItem) {
    try {
      const { downloadUrl } = await vehiclesApi.getDocumentDownloadUrl(
        vehicleId,
        doc.id,
      );
      window.open(downloadUrl, '_blank');
    } catch {
      // presign hiba átmeneti – csendben
    }
  }

  if (!loaded || docs.length === 0) return null;

  return (
    <Card className="mt-6 p-0">
      <div className="border-b border-anthracite-100 px-4 py-3">
        <h2 className="text-base font-semibold text-anthracite-900">
          {t('title')}
        </h2>
      </div>
      <div className="divide-y divide-anthracite-100">
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => void open(doc)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-anthracite-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-anthracite-900">
                {doc.fileName}
              </p>
              <p className="text-xs text-anthracite-500">
                {doc.kind === 'registration'
                  ? t('kind.registration')
                  : t('kind.other')}{' '}
                ·{' '}
                {new Date(doc.createdAt).toLocaleDateString(locale)}
              </p>
            </div>
            <span className="shrink-0 text-sm text-primary-600">
              {t('open')}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
