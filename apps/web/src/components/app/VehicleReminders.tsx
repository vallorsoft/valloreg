'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { ReminderType } from '@valloreg/shared';
import {
  remindersApi,
  ApiError,
  type Reminder,
  type ReminderSuggestion,
  type Vehicle,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ReminderRow } from '@/components/app/ReminderRow';
import { ReminderFormModal } from '@/components/app/ReminderFormModal';

/**
 * Egy jármű emlékeztetői + a szerviztörténetből származó (automatikus)
 * karbantartási javaslatok. A REMINDERS feature hiányában (403) csendben
 * elrejtjük a panelt.
 */
export function VehicleReminders({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations('reminders');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [suggestions, setSuggestions] = useState<ReminderSuggestion[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        remindersApi.list(vehicle.id),
        remindersApi.suggestions(vehicle.id).catch(() => []),
      ]);
      setReminders(r);
      setSuggestions(s);
    } catch (err) {
      // 403 = a feature nincs engedélyezve → a panelt nem mutatjuk.
      if (err instanceof ApiError && err.status === 403) setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [vehicle.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function handleSaved(saved: Reminder) {
    setReminders((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSuggestions((prev) => prev.filter((s) => s.type !== saved.type));
    setModalOpen(false);
    setEditing(null);
  }

  async function applySuggestion(s: ReminderSuggestion) {
    setError(null);
    try {
      const created = await remindersApi.create({
        vehicleId: vehicle.id,
        kind: s.kind,
        type: s.type,
        dueDate: s.dueDate ?? undefined,
        dueOdometerKm: s.dueOdometerKm ?? undefined,
        intervalDays: s.intervalDays ?? undefined,
        intervalKm: s.intervalKm ?? undefined,
      });
      handleSaved(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('form.errorGeneric'));
    }
  }

  async function handleComplete(r: Reminder) {
    setBusyId(r.id);
    try {
      handleSaved(await remindersApi.complete(r.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('form.errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(r: Reminder) {
    if (!window.confirm(t('actions.confirmDelete'))) return;
    setBusyId(r.id);
    try {
      await remindersApi.remove(r.id);
      setReminders((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('form.errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  if (!available || loading) return null;

  return (
    <Card className="mt-6 p-0">
      <div className="flex items-center justify-between border-b border-anthracite-100 px-4 py-3">
        <h2 className="text-base font-semibold text-anthracite-900">
          {t('vehicleSectionTitle')}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          {t('addReminder')}
        </Button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}

      {reminders.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-anthracite-500">
          {t('empty.description')}
        </p>
      ) : (
        <div className="divide-y divide-anthracite-100">
          {reminders.map((r) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              onComplete={handleComplete}
              onEdit={(rem) => {
                setEditing(rem);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
              busy={busyId === r.id}
            />
          ))}
        </div>
      )}

      {/* Automatikus javaslatok a szerviztörténetből. */}
      {suggestions.length > 0 && (
        <div className="border-t border-anthracite-100 bg-anthracite-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-anthracite-500">
            {t('suggestionsTitle')}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.type}
                onClick={() => void applySuggestion(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
              >
                <span aria-hidden="true">+</span>
                {t(`types.${s.type as ReminderType}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <ReminderFormModal
          vehicles={[vehicle]}
          reminder={editing}
          defaultVehicleId={vehicle.id}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </Card>
  );
}
