'use client';

import { useTranslations } from 'next-intl';
import type { ReminderType } from '@valloreg/shared';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { Reminder, ReminderStatusValue } from '@/lib/api';

const STATUS_TONE: Record<ReminderStatusValue, BadgeTone> = {
  overdue: 'danger',
  due_soon: 'warning',
  ok: 'success',
};

const KIND_ICON: Record<string, string> = {
  maintenance: '🔧',
  compliance: '📅',
};

interface Props {
  reminder: Reminder;
  compact?: boolean;
  onComplete?: (r: Reminder) => void;
  onEdit?: (r: Reminder) => void;
  onDelete?: (r: Reminder) => void;
  busy?: boolean;
}

export function ReminderRow({
  reminder: r,
  compact = false,
  onComplete,
  onEdit,
  onDelete,
  busy = false,
}: Props) {
  const t = useTranslations('reminders');
  const vehicleLabel =
    r.vehicle?.plate ||
    [r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(' ') ||
    '—';
  const typeLabel = r.title || t(`types.${r.type as ReminderType}`);

  function remainingText(): string {
    if (r.status === 'overdue') {
      if (r.daysRemaining != null && r.daysRemaining < 0)
        return t('remaining.overdueDays', { days: Math.abs(r.daysRemaining) });
      if (r.kmRemaining != null && r.kmRemaining < 0)
        return t('remaining.overdueKm', { km: Math.abs(r.kmRemaining) });
      return t('status.overdue');
    }
    const parts: string[] = [];
    if (r.daysRemaining != null && r.daysRemaining >= 0)
      parts.push(t('remaining.days', { days: r.daysRemaining }));
    if (r.kmRemaining != null && r.kmRemaining >= 0)
      parts.push(t('remaining.km', { km: r.kmRemaining }));
    return parts.join(' · ') || '—';
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="text-lg">
          {KIND_ICON[r.kind] ?? '🔔'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-anthracite-900">
            {typeLabel}
          </p>
          <p className="truncate text-xs text-anthracite-500">
            {vehicleLabel} · {remainingText()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={STATUS_TONE[r.status]}>{t(`status.${r.status}`)}</Badge>
        {!compact && (
          <div className="flex items-center gap-2">
            {onComplete && (
              <button
                className="text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
                disabled={busy}
                onClick={() => onComplete(r)}
              >
                {t('actions.complete')}
              </button>
            )}
            {onEdit && (
              <button
                className="text-xs text-anthracite-500 hover:underline"
                onClick={() => onEdit(r)}
              >
                {t('actions.edit')}
              </button>
            )}
            {onDelete && (
              <button
                className="text-xs text-red-500 hover:underline disabled:opacity-50"
                disabled={busy}
                onClick={() => onDelete(r)}
              >
                {t('actions.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
