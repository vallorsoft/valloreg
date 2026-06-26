'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi, dsrApi } from '@/lib/api';
import { clearTokens, getActiveTenantId } from '@/lib/auth';

export function AccountClient() {
  const t = useTranslations('account.twoFactor');
  const td = useTranslations('dsr');
  const router = useRouter();

  const [twoFaEnabled, setTwoFaEnabled] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // 2FA setup state
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [disablePwd, setDisablePwd] = useState('');
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);
  const [twoFaErr, setTwoFaErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // DSR state
  const [dsrBusy, setDsrBusy] = useState(false);
  const [dsrErr, setDsrErr] = useState<string | null>(null);
  const [accountPwd, setAccountPwd] = useState('');
  const [tenantPwd, setTenantPwd] = useState('');

  useEffect(() => {
    authApi
      .me()
      .then((me) => {
        setTwoFaEnabled(me.user.twoFactorEnabled);
        const activeId = getActiveTenantId();
        const active = me.memberships.find((m) => m.tenantId === activeId);
        setIsOwner((active?.role ?? '') === 'OWNER');
      })
      .catch(() => setTwoFaEnabled(false));
  }, []);

  async function startSetup() {
    setBusy(true);
    setTwoFaErr(null);
    setTwoFaMsg(null);
    try {
      const res = await authApi.beginTwoFactorSetup();
      setSetupSecret(res.secret);
      setSetupUri(res.otpAuthUri);
    } catch {
      setTwoFaErr(t('invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    if (!setupSecret) return;
    setBusy(true);
    setTwoFaErr(null);
    try {
      await authApi.confirmTwoFactor(setupSecret, code.trim());
      setTwoFaEnabled(true);
      setSetupSecret(null);
      setSetupUri(null);
      setCode('');
      setTwoFaMsg(t('successEnabled'));
    } catch {
      setTwoFaErr(t('invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setTwoFaErr(null);
    try {
      await authApi.disableTwoFactor(disablePwd);
      setTwoFaEnabled(false);
      setDisablePwd('');
      setTwoFaMsg(t('successDisabled'));
    } catch {
      setTwoFaErr(t('invalid'));
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setDsrBusy(true);
    setDsrErr(null);
    try {
      const blob = await dsrApi.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valloreg-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDsrErr(td('error'));
    } finally {
      setDsrBusy(false);
    }
  }

  async function deleteAccount() {
    setDsrBusy(true);
    setDsrErr(null);
    try {
      await dsrApi.deleteAccount(accountPwd);
      clearTokens();
      router.push('/login');
    } catch {
      setDsrErr(td('error'));
    } finally {
      setDsrBusy(false);
    }
  }

  async function deleteTenant() {
    setDsrBusy(true);
    setDsrErr(null);
    try {
      await dsrApi.deleteTenant(tenantPwd);
      clearTokens();
      router.push('/login');
    } catch {
      setDsrErr(td('error'));
    } finally {
      setDsrBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── 2FA ─────────────────────────────────────────────────────── */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-anthracite-900">
            {t('heading')}
          </h2>
          <p className="mt-1 text-sm text-anthracite-500">
            {t('statusLabel')}:{' '}
            <span className="font-semibold">
              {twoFaEnabled ? t('enabled') : t('disabled')}
            </span>
          </p>
        </div>

        {twoFaMsg && <p className="text-sm text-green-700">{twoFaMsg}</p>}
        {twoFaErr && <p className="text-sm text-red-600">{twoFaErr}</p>}

        {twoFaEnabled === false && !setupSecret && (
          <>
            <p className="text-sm text-anthracite-600">{t('intro')}</p>
            <Button size="sm" disabled={busy} onClick={() => void startSetup()}>
              {busy ? t('working') : t('enable')}
            </Button>
          </>
        )}

        {setupSecret && (
          <div className="space-y-3">
            <p className="text-sm text-anthracite-600">{t('setupIntro')}</p>
            <div>
              <p className="text-xs font-medium text-anthracite-700">
                {t('secretLabel')}
              </p>
              <code className="mt-1 block break-all rounded-lg bg-anthracite-50 p-2 text-sm">
                {setupSecret}
              </code>
            </div>
            {setupUri && (
              <a
                href={setupUri}
                className="block break-all text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                {t('uriLabel')}
              </a>
            )}
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              label={t('codeLabel')}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void confirmSetup()}
              >
                {busy ? t('working') : t('confirm')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setSetupSecret(null);
                  setSetupUri(null);
                  setCode('');
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

        {twoFaEnabled === true && (
          <div className="space-y-2">
            <Input
              name="disablePwd"
              type="password"
              autoComplete="current-password"
              label={t('passwordLabel')}
              value={disablePwd}
              onChange={(e) => setDisablePwd(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !disablePwd}
              onClick={() => void disable()}
            >
              {busy ? t('working') : t('confirmDisable')}
            </Button>
          </div>
        )}
      </Card>

      {/* ── GDPR / DSR ──────────────────────────────────────────────── */}
      <Card className="space-y-5">
        <h2 className="text-lg font-bold text-anthracite-900">
          {td('heading')}
        </h2>
        {dsrErr && <p className="text-sm text-red-600">{dsrErr}</p>}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-anthracite-900">
            {td('exportTitle')}
          </p>
          <p className="text-sm text-anthracite-500">{td('exportDesc')}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={dsrBusy}
            onClick={() => void exportData()}
          >
            {dsrBusy ? td('exporting') : td('exportButton')}
          </Button>
        </div>

        <div className="space-y-2 border-t border-anthracite-100 pt-4">
          <p className="text-sm font-semibold text-red-700">
            {td('deleteAccountTitle')}
          </p>
          <p className="text-sm text-anthracite-500">
            {td('deleteAccountDesc')}
          </p>
          <Input
            name="accountPwd"
            type="password"
            autoComplete="current-password"
            label={td('passwordLabel')}
            value={accountPwd}
            onChange={(e) => setAccountPwd(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={dsrBusy || !accountPwd}
            className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => void deleteAccount()}
          >
            {td('deleteAccountButton')}
          </Button>
        </div>

        {isOwner && (
          <div className="space-y-2 border-t border-anthracite-100 pt-4">
            <p className="text-sm font-semibold text-red-700">
              {td('deleteTenantTitle')}
            </p>
            <p className="text-sm text-anthracite-500">
              {td('deleteTenantDesc')}
            </p>
            <Input
              name="tenantPwd"
              type="password"
              autoComplete="current-password"
              label={td('passwordLabel')}
              value={tenantPwd}
              onChange={(e) => setTenantPwd(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={dsrBusy || !tenantPwd}
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => void deleteTenant()}
            >
              {td('deleteTenantButton')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
