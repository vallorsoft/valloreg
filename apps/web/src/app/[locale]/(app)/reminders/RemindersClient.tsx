'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  remindersApi,
  vehiclesApi,
  ApiError,
  type Reminder,
  type ReminderStatusValue,
  type Vehicle,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { ReminderRow } from '@/components/app/ReminderRow';
import { ReminderFormModal } from '@/components/app/ReminderFormModal';

const GROUPS: ReminderStatusValue[] = ['overdue', 'due_soon', 'ok'];

export function RemindersClient() {
  const t = useTranslations('reminders');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [r, v] = await Promise.all([
        remindersApi.list(),
        vehiclesApi.list(),
      ]);
      setReminders(r);
      setVehicles(v);
    } catch {
      // 401 → AppShell redirect
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

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
    setModalOpen(false);
    setEditing(null);
  }

  async function handleComplete(r: Reminder) {
    setBusyId(r.id);
    setError(null);
    try {
      const updated = await remindersApi.complete(r.id);
      handleSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('form.errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(r: Reminder) {
    if (!window.confirm(t('actions.confirmDelete'))) return;
    setBusyId(r.id);
    setError(null);
    try {
      await remindersApi.remove(r.id);
      setReminders((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('form.errorGeneric'));
    } finally {
      setBusyId(null);
    }
  }

  const grouped: Record<ReminderStatusValue, Reminder[]> = {
    overdue: [],
    due_soon: [],
    ok: [],
  };
  for (const r of reminders) grouped[r.status].push(r);

  return (
    <>
      <PageHeading
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button size="sm" onClick={openAdd} disabled={vehicles.length === 0}>
            {t('addReminder')}
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-anthracite-500">
          {t('loading')}
        </p>
      ) : reminders.length === 0 ? (
        <Card className="py-16">
          <div className="mx-auto max-w-sm text-center">
            <h2 className="text-base font-semibold text-anthracite-900">
              {t('empty.title')}
            </h2>
            <p className="mt-1 text-sm text-anthracite-500">
              {vehicles.length === 0
                ? t('empty.noVehicles')
                : t('empty.description')}
            </p>
            {vehicles.length > 0 && (
              <Button className="mt-4" variant="outline" size="sm" onClick={openAdd}>
                {t('empty.cta')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) =>
            grouped[group].length === 0 ? null : (
              <div key={group}>
                <h2 className="mb-2 text-sm font-semibold text-anthracite-700">
                  {t(`groups.${group}`)} ({grouped[group].length})
                </h2>
                <Card className="divide-y divide-anthracite-100 p-0">
                  {grouped[group].map((r) => (
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
                </Card>
              </div>
            ),
          )}
        </div>
      )}

      {modalOpen && (
        <ReminderFormModal
          vehicles={vehicles}
          reminder={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
