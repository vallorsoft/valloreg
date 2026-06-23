'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { vehiclesApi, ApiError, type Vehicle } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { VehicleFormModal } from '@/components/app/VehicleFormModal';
import { VehicleScanModal } from '@/components/app/VehicleScanModal';

export function VehiclesClient() {
  const t = useTranslations('vehicles');
  const locale = useLocale();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVehicles(await vehiclesApi.list());
    } catch {
      // 401 → AppShell redirect
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setModalOpen(true);
  }

  function handleSaved(v: Vehicle) {
    setVehicles((prev) => {
      const idx = prev.findIndex((x) => x.id === v.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = v;
        return next;
      }
      return [v, ...prev];
    });
    setModalOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('actions.confirmDelete'))) return;
    setDeleting(true);
    setDeleteError(null);
    setDeleteId(id);
    try {
      await vehiclesApi.remove(id);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t('actions.deleteError'));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  const COLUMNS = ['plate', 'make', 'model', 'year', 'odometer', 'actions'] as const;

  return (
    <>
      <PageHeading
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
              {t('scanRegistration')}
            </Button>
            <Button size="sm" onClick={openAdd}>
              {t('addVehicle')}
            </Button>
          </div>
        }
      />

      {deleteError && (
        <p className="mb-4 text-sm text-red-600">{deleteError}</p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                    {col === 'actions' ? t('table.actions') : t(`table.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-sm text-anthracite-500">
                    {t('loading')}
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-16">
                    <div className="mx-auto max-w-sm text-center">
                      <h2 className="text-base font-semibold text-anthracite-900">{t('empty.title')}</h2>
                      <p className="mt-1 text-sm text-anthracite-500">{t('empty.description')}</p>
                      <Button className="mt-4" variant="outline" size="sm" onClick={openAdd}>
                        {t('empty.cta')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-anthracite-50">
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="text-primary-600 hover:underline"
                        onClick={() => router.push(`/${locale}/vehicles/${v.id}`)}
                      >
                        {v.plate ?? '-'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-anthracite-600">{v.make ?? '-'}</td>
                    <td className="px-4 py-3 text-anthracite-600">{v.model ?? '-'}</td>
                    <td className="px-4 py-3 text-anthracite-600">{v.year ?? '-'}</td>
                    <td className="px-4 py-3 text-anthracite-600">
                      {v.odometerKm != null ? v.odometerKm.toLocaleString() + ' km' : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          className="text-sm text-primary-600 hover:underline"
                          onClick={() => router.push(`/${locale}/vehicles/${v.id}`)}
                        >
                          {t('actions.history')}
                        </button>
                        <button
                          className="text-sm text-primary-600 hover:underline"
                          onClick={() => openEdit(v)}
                        >
                          {t('actions.edit')}
                        </button>
                        <button
                          className="text-sm text-red-500 hover:underline disabled:opacity-50"
                          disabled={deleting && deleteId === v.id}
                          onClick={() => void handleDelete(v.id)}
                        >
                          {deleting && deleteId === v.id ? t('actions.deleting') : t('actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <VehicleFormModal
          vehicle={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {scanOpen && (
        <VehicleScanModal
          onClose={() => setScanOpen(false)}
          onSaved={(vehicleId) => {
            setScanOpen(false);
            void refresh();
            router.push(`/${locale}/vehicles/${vehicleId}`);
          }}
        />
      )}
    </>
  );
}
