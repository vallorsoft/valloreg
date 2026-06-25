'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  authApi,
  resolveErrorKey,
  errorDebugSuffix,
  type TwoFactorSetup,
} from '@/lib/api';

type Phase = 'loading' | 'disabled' | 'setup' | 'enabled' | 'disabling';

/**
 * Kétfaktoros hitelesítés (2FA) ki/bekapcsoló kártya a felhasználónak.
 * A 2FA ALAPÉRTELMEZETTEN KIKAPCSOLT; a felhasználó itt kapcsolhatja be.
 *
 * Bekapcsolás: setup (secret + otpauth) → a hitelesítő appba felvétel → a kód
 * megerősítésével aktiválás. Kikapcsolás: érvényes kóddal.
 */
export function TwoFactorCard() {
  const t = useTranslations('settings.twoFactor');
  const te = useTranslations('auth.errors');

  const [phase, setPhase] = useState<Phase>('loading');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then((me) => setPhase(me.user.twoFactorEnabled ? 'enabled' : 'disabled'))
      .catch(() => setPhase('disabled'));
  }, []);

  function onlyDigits(v: string): string {
    return v.replace(/\D/g, '').slice(0, 6);
  }

  /** A kulcs 4-es csoportokban a könnyebb kézi bevitelhez (a szóközöket az
   *  authenticator appok figyelmen kívül hagyják). */
  function groupSecret(secret: string): string {
    return secret.replace(/(.{4})/g, '$1 ').trim();
  }

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.setupTwoFactor();
      setSetup(res);
      setCode('');
      setPhase('setup');
    } catch (err) {
      setError(te(resolveErrorKey(err)) + errorDebugSuffix(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.enableTwoFactor(code);
      setSetup(null);
      setCode('');
      setPhase('enabled');
    } catch (err) {
      setError(te(resolveErrorKey(err)) + errorDebugSuffix(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.disableTwoFactor(code);
      setCode('');
      setPhase('disabled');
    } catch (err) {
      setError(te(resolveErrorKey(err)) + errorDebugSuffix(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-anthracite-900">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-anthracite-500">{t('description')}</p>
        </div>
        {phase === 'enabled' ? (
          <Badge tone="success">{t('statusOn')}</Badge>
        ) : phase !== 'loading' ? (
          <Badge tone="neutral">{t('statusOff')}</Badge>
        ) : null}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {phase === 'loading' && (
        <p className="text-sm text-anthracite-400">{t('loading')}</p>
      )}

      {/* KIKAPCSOLT: egyetlen bekapcsoló gomb. */}
      {phase === 'disabled' && (
        <Button onClick={() => void startSetup()} disabled={busy}>
          {busy ? t('working') : t('enableButton')}
        </Button>
      )}

      {/* SETUP: secret + otpauth link + kód megerősítés. */}
      {phase === 'setup' && setup && (
        <div className="space-y-3">
          <p className="text-sm text-anthracite-600">{t('setupInstructions')}</p>
          <div className="rounded-xl border border-anthracite-100 bg-anthracite-50 p-3">
            <p className="text-xs font-medium text-anthracite-500">
              {t('secretLabel')}
            </p>
            <p className="mt-1 select-all break-all font-mono text-sm tracking-wider text-anthracite-900">
              {groupSecret(setup.secret)}
            </p>
            <a
              href={setup.otpauthUrl}
              className="mt-2 inline-block text-sm font-medium text-primary-700 underline hover:text-primary-800"
            >
              {t('openInApp')}
            </a>
          </div>
          <Input
            name="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            label={t('codeLabel')}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(onlyDigits(e.target.value))}
          />
          <div className="flex gap-2">
            <Button onClick={() => void confirmEnable()} disabled={busy || code.length !== 6}>
              {busy ? t('working') : t('confirmEnable')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSetup(null);
                setCode('');
                setError(null);
                setPhase('disabled');
              }}
              disabled={busy}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* BEKAPCSOLT: kikapcsolás kóddal. */}
      {phase === 'enabled' && (
        <Button
          variant="outline"
          onClick={() => {
            setCode('');
            setError(null);
            setPhase('disabling');
          }}
        >
          {t('disableButton')}
        </Button>
      )}

      {phase === 'disabling' && (
        <div className="space-y-3">
          <p className="text-sm text-anthracite-600">{t('disableInstructions')}</p>
          <Input
            name="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            label={t('codeLabel')}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(onlyDigits(e.target.value))}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void confirmDisable()}
              disabled={busy || code.length !== 6}
            >
              {busy ? t('working') : t('confirmDisable')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCode('');
                setError(null);
                setPhase('enabled');
              }}
              disabled={busy}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
