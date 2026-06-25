'use client';

import { Button } from '@/components/ui/Button';
import { openConsentSettings } from './ConsentBanner';

/** Buton client care redeschide bara de preferințe cookie (folosit din pagini server). */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => openConsentSettings()}>
      {label}
    </Button>
  );
}
