'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALL_REMINDER_TYPES,
  REMINDER_KIND_BY_TYPE,
  type ReminderType,
} from '@valloreg/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useModalA11y } from '@/components/app/useModalA11y';
import {
  remindersApi,
  ApiError,
  type Reminder,
  type Vehicle,
  type CreateReminderPayload,
} from '@/lib/api';

interface Props {
  vehicles: Vehicle[];
  reminder?: Reminder | null;
  defaultVehicleId?: string;
  onClose: () => void;
  onSaved: (reminder: Reminder) => void;
}

interface FormState {
  vehicleId: string;
  type: string;
  title: string;
  dueDate: string;
  dueOdometerKm: string;
  intervalDays: string;
  intervalKm: string;
  notes: string;
}

const EMPTY: FormState = {
  vehicleId: '',
  type: 'oil_change',
  title: '',
  dueDate: '',
  dueOdometerKm: '',
  intervalDays: '',
  intervalKm: '',
  notes: '',
};

export function ReminderFormModal({
  vehicles,
  reminder,
  defaultVehicleId,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('reminders');
  const dialogRef = useModalA11y(onClose);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    vehicleId: defaultVehicleId ?? vehicles[0]?.id ?? '',
  });

  useEffect(() => {
    if (reminder) {
      setForm({
        vehicleId: reminder.vehicleId,
        type: reminder.type,
        title: reminder.title ?? '',
        dueDate: reminder.dueDate ? reminder.dueDate.slice(0, 10) : '',
        dueOdometerKm: reminder.dueOdometerKm?.toString() ?? '',
        intervalDays: reminder.intervalDays?.toString() ?? '',
        intervalKm: reminder.intervalKm?.toString() ?? '',
        notes: reminder.notes ?? '',
      });
    }
  }, [reminder]);

  function set<K extends keyof FormState>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function numOrUndefined(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const kind = REMINDER_KIND_BY_TYPE[form.type as ReminderType] ?? 'compliance';
      const payload: CreateReminderPayload = {
        vehicleId: form.vehicleId,
        kind,
        type: form.type,
      };
      if (form.title.trim()) payload.title = form.title.trim();
      if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();
      const dueKm = numOrUndefined(form.dueOdometerKm);
      if (dueKm !== undefined) payload.dueOdometerKm = dueKm;
      const intDays = numOrUndefined(form.intervalDays);
      if (intDays !== undefined) payload.intervalDays = intDays;
      const intKm = numOrUndefined(form.intervalKm);
      if (intKm !== undefined) payload.intervalKm = intKm;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const saved = reminder
        ? await remindersApi.update(reminder.id, {
            kind,
            type: form.type,
            title: payload.title ?? '',
            dueDate: payload.dueDate,
            dueOdometerKm: dueKm,
            intervalDays: intDays,
            intervalKm: intKm,
            notes: payload.notes ?? '',
          })
        : await remindersApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('form.errorGeneric'));
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
        aria-labelledby="reminder-form-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card-hover focus:outline-none"
      >
        <h2 id="reminder-form-title" className="mb-6 text-lg font-semibold text-anthracite-900">
          {reminder ? t('form.editTitle') : t('form.addTitle')}
        </h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Jármű */}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">
              {t('form.vehicle')}
            </span>
            <select
              className="w-full rounded-xl border border-anthracite-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              value={form.vehicleId}
              onChange={(e) => set('vehicleId', e.target.value)}
              required
              disabled={!!reminder}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate ?? [v.make, v.model].filter(Boolean).join(' ') ?? v.id}
                </option>
              ))}
            </select>
          </label>

          {/* Típus */}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-anthracite-700">
              {t('form.type')}
            </span>
            <select
              className="w-full rounded-xl border border-anthracite-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
            >
              {ALL_REMINDER_TYPES.map((typeKey) => (
                <option key={typeKey} value={typeKey}>
                  {t(`types.${typeKey}`)}
                </option>
              ))}
            </select>
          </label>

          <Input
            label={t('form.titleLabel')}
            placeholder={t('form.titlePlaceholder')}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.dueDate')}
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
            <Input
              label={t('form.dueOdometerKm')}
              type="number"
              placeholder="150000"
              value={form.dueOdometerKm}
              onChange={(e) => set('dueOdometerKm', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.intervalDays')}
              type="number"
              placeholder="365"
              value={form.intervalDays}
              onChange={(e) => set('intervalDays', e.target.value)}
            />
            <Input
              label={t('form.intervalKm')}
              type="number"
              placeholder="15000"
              value={form.intervalKm}
              onChange={(e) => set('intervalKm', e.target.value)}
            />
          </div>

          <Input
            label={t('form.notes')}
            placeholder={t('form.notesPlaceholder')}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />

          <p className="text-xs text-anthracite-400">{t('form.hint')}</p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving || !form.vehicleId}>
              {saving ? t('form.saving') : t('form.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
