import { useTranslations } from 'next-intl';
import { DocumentStatus } from '@valloreg/shared';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

// Map each status to a semantic badge tone.
const TONES: Record<DocumentStatus, BadgeTone> = {
  [DocumentStatus.UPLOADED]: 'neutral',
  [DocumentStatus.QUEUED]: 'neutral',
  [DocumentStatus.OCR_RUNNING]: 'info',
  [DocumentStatus.EXTRACTING]: 'info',
  [DocumentStatus.NEEDS_REVIEW]: 'warning',
  [DocumentStatus.AUTO_OK]: 'success',
  [DocumentStatus.CONFIRMED]: 'success',
  [DocumentStatus.FAILED]: 'danger',
  [DocumentStatus.ARCHIVED]: 'neutral',
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const t = useTranslations('documents.status');
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
