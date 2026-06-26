'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Megkülönbözteti a „valódi" betöltési hibát a 401/403-tól. A 401-et az AppShell
 * kezeli (redirect), a 403-at a hívó a feature-off/üres állapottal jeleníti meg –
 * ezért ezekre NEM mutatunk hibát. Minden más (500, hálózat, stb.) → true.
 */
export function isRealLoadError(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return false;
    return true;
  }
  // Nem ApiError (pl. váratlan kivétel) – valódi hibának tekintjük.
  return true;
}

/**
 * Közös hibaállapot: világos üzenet + „Újra" gomb, ami újrafuttatja a betöltést.
 * Így a 500/hálózati hiba nem üres bérlőnek látszik.
 */
export function LoadErrorState({ onRetry }: { onRetry: () => void }) {
  // TODO i18n: needs dedicated keys (e.g. common.errors.load + common.actions.retry).
  // Reusing existing keys: notifications.error (message) + vehicles.scan.rescan ("Újra" = retry).
  const tn = useTranslations('notifications');
  const tv = useTranslations('vehicles.scan');
  return (
    <Card className="py-12">
      <div className="mx-auto max-w-sm text-center">
        <p className="text-sm text-anthracite-600">{tn('error')}</p>
        <Button className="mt-4" variant="outline" size="sm" onClick={onRetry}>
          {tv('rescan')}
        </Button>
      </div>
    </Card>
  );
}
