'use client';

import { useTranslations } from 'next-intl';
import { VehicleScanStatus } from '@valloreg/shared';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { VehicleScanStatus as VehicleScanStatusValue } from '@/lib/api';

const TONES: Record<VehicleScanStatusValue, BadgeTone> = {
  [VehicleScanStatus.PENDING]: 'neutral',
  [VehicleScanStatus.OCR_RUNNING]: 'info',
  [VehicleScanStatus.EXTRACTING]: 'info',
  [VehicleScanStatus.DONE]: 'success',
  [VehicleScanStatus.FAILED]: 'danger',
  [VehicleScanStatus.CONFIRMED]: 'success',
};

export function VehicleScanStatusBadge({ status }: { status: VehicleScanStatusValue }) {
  const t = useTranslations('vehicles.scans.status');
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
