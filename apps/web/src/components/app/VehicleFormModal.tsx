'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useModalA11y } from '@/components/app/useModalA11y';
import { vehiclesApi, ApiError, type Vehicle, type CreateVehiclePayload } from '@/lib/api';
import {
  VehicleDetailsFields,
  emptyExtraState,
  extraStateFromVehicle,
  extraStateToPayload,
  type VehicleExtraState,
} from '@/components/app/VehicleDetailsFields';

interface Props {
  vehicle?: Vehicle | null;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

export function VehicleFormModal({ vehicle, onClose, onSaved }: Props) {
  const t = useTranslations('vehicles');
  // Generic save/error message (NOT the delete-error copy). Reuses an existing key.
  // TODO i18n: needs a dedicated vehicles.form.saveError key.
  const tn = useTranslations('notifications');
  const dialogRef = useModalA11y(onClose);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateVehiclePayload>({
    plate: '',
    make: '',
    model: '',
    year: undefined,
    vin: '',
    odometerKm: undefined,
  });
  const [extra, setExtra] = useState<VehicleExtraState>(emptyExtraState());

  useEffect(() => {
    if (vehicle) {
      setForm({
        plate: vehicle.plate ?? '',
        make: vehicle.make ?? '',
        model: vehicle.model ?? '',
        year: vehicle.year ?? undefined,
        vin: vehicle.vin ?? '',
        odometerKm: vehicle.odometerKm ?? undefined,
      });
      setExtra(extraStateFromVehicle(vehicle));
    }
  }, [vehicle]);

  function set(field: keyof CreateVehiclePayload, value: string) {
    if (field === 'year' || field === 'odometerKm') {
      const n = value === '' ? undefined : parseInt(value, 10);
      setForm((prev) => ({ ...prev, [field]: isNaN(n as number) ? undefined : n }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value || undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: CreateVehiclePayload = { ...extraStateToPayload(extra) };
      if (form.plate) payload.plate = form.plate;
      if (form.make) payload.make = form.make;
      if (form.model) payload.model = form.model;
      if (form.year) payload.year = form.year;
      if (form.vin) payload.vin = form.vin;
      if (form.odometerKm) payload.odometerKm = form.odometerKm;

      const saved = vehicle
        ? await vehiclesApi.update(vehicle.id, payload)
        : await vehiclesApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tn('error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-anthracite-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-form-title"
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-hover focus:outline-none"
      >
        <h2 id="vehicle-form-title" className="mb-6 text-lg font-semibold text-anthracite-900">
          {vehicle ? t('form.editTitle') : t('form.addTitle')}
        </h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.plate')}
              placeholder={t('form.platePlaceholder')}
              value={form.plate ?? ''}
              onChange={(e) => set('plate', e.target.value)}
            />
            <Input
              label={t('form.year')}
              type="number"
              placeholder={t('form.yearPlaceholder')}
              value={form.year?.toString() ?? ''}
              onChange={(e) => set('year', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.make')}
              placeholder={t('form.makePlaceholder')}
              value={form.make ?? ''}
              onChange={(e) => set('make', e.target.value)}
            />
            <Input
              label={t('form.model')}
              placeholder={t('form.modelPlaceholder')}
              value={form.model ?? ''}
              onChange={(e) => set('model', e.target.value)}
            />
          </div>
          <Input
            label={t('form.odometerKm')}
            type="number"
            placeholder={t('form.odometerKmPlaceholder')}
            value={form.odometerKm?.toString() ?? ''}
            onChange={(e) => set('odometerKm', e.target.value)}
          />
          <Input
            label={t('form.vin')}
            placeholder={t('form.vinPlaceholder')}
            value={form.vin ?? ''}
            onChange={(e) => set('vin', e.target.value)}
          />

          <div className="border-t border-anthracite-100 pt-4">
            <VehicleDetailsFields value={extra} onChange={setExtra} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('form.saving') : t('form.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
