'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ALL_TENANT_ROLES, TenantRole } from '@valloreg/shared';
import {
  usersApi,
  authApi,
  ApiError,
  type TeamMember,
  type PendingInvitation,
} from '@/lib/api';
import { getActiveTenantId } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';

const MANAGER_ROLES = new Set<string>([TenantRole.OWNER, TenantRole.ADMIN]);

export function TeamClient() {
  const t = useTranslations('team');
  const locale = useLocale();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>(TenantRole.VIEWER);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const roleLabel = useCallback(
    (role: string) => t(`roles.${role}` as Parameters<typeof t>[0]),
    [t],
  );

  const load = useCallback(async () => {
    try {
      const me = await authApi.me();
      setCurrentUserId(me.user.id);
      const tenantId = getActiveTenantId();
      const membership = me.memberships.find((m) => m.tenantId === tenantId);
      const manage = membership ? MANAGER_ROLES.has(membership.role) : false;
      setCanManage(manage);

      const memberList = await usersApi.listMembers();
      setMembers(memberList);

      if (manage) {
        setInvitations(await usersApi.listInvitations());
      }
    } catch {
      // 401 → AppShell redirect
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setInviting(true);
    try {
      await usersApi.invite({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteRole(TenantRole.VIEWER);
      setNotice(t('invite.success'));
      setInvitations(await usersApi.listInvitations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('invite.error'));
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(membershipId: string, role: string) {
    setError(null);
    try {
      await usersApi.changeRole(membershipId, role);
      setMembers((prev) =>
        prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('members.roleError'));
    }
  }

  async function handleRemoveMember(m: TeamMember) {
    if (!window.confirm(t('members.confirmRemove', { email: m.user.email }))) return;
    setError(null);
    try {
      await usersApi.removeMember(m.membershipId);
      setMembers((prev) => prev.filter((x) => x.membershipId !== m.membershipId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('members.removeError'));
    }
  }

  async function handleRevoke(inv: PendingInvitation) {
    if (!window.confirm(t('invitations.confirmRevoke', { email: inv.email }))) return;
    setError(null);
    try {
      await usersApi.revokeInvitation(inv.id);
      setInvitations((prev) => prev.filter((x) => x.id !== inv.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('invitations.revokeError'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 text-sm text-green-600">{notice}</p>}

      {/* Tagok */}
      <Card className="mb-6 overflow-hidden p-0">
        <div className="border-b border-anthracite-100 px-4 py-3">
          <h2 className="text-base font-semibold text-anthracite-900">
            {t('members.title')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('members.name')}</th>
                <th className="px-4 py-3 font-semibold">{t('members.email')}</th>
                <th className="px-4 py-3 font-semibold">{t('members.role')}</th>
                {canManage && (
                  <th className="px-4 py-3 font-semibold text-right">
                    {t('members.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-anthracite-100">
              {members.map((m) => (
                <tr key={m.membershipId}>
                  <td className="px-4 py-3 font-medium text-anthracite-900">
                    {m.user.name ?? '-'}
                    {m.user.id === currentUserId && (
                      <span className="ml-1.5 text-xs text-anthracite-400">
                        ({t('members.you')})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-anthracite-600">{m.user.email}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          void handleRoleChange(m.membershipId, e.target.value)
                        }
                        className="rounded-lg border border-anthracite-200 bg-white px-2 py-1 text-sm text-anthracite-900"
                      >
                        {ALL_TENANT_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-anthracite-600">{roleLabel(m.role)}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-sm text-red-500 hover:underline"
                        onClick={() => void handleRemoveMember(m)}
                      >
                        {t('members.remove')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canManage && (
        <>
          {/* Meghívás */}
          <Card className="mb-6">
            <h2 className="mb-4 text-base font-semibold text-anthracite-900">
              {t('invite.title')}
            </h2>
            <form
              onSubmit={(e) => void handleInvite(e)}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="mb-1 block text-xs text-anthracite-500">
                  {t('invite.email')}
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('invite.emailPlaceholder')}
                  className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-anthracite-500">
                  {t('invite.role')}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900 sm:w-48"
                >
                  {ALL_TENANT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" disabled={inviting}>
                {inviting ? t('invite.sending') : t('invite.submit')}
              </Button>
            </form>
            <p className="mt-2 text-xs text-anthracite-400">{t('invite.note')}</p>
          </Card>

          {/* Függő meghívók */}
          <Card className="overflow-hidden p-0">
            <div className="border-b border-anthracite-100 px-4 py-3">
              <h2 className="text-base font-semibold text-anthracite-900">
                {t('invitations.title')}
              </h2>
            </div>
            {invitations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-anthracite-500">
                {t('invitations.empty')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('invitations.email')}</th>
                      <th className="px-4 py-3 font-semibold">{t('invitations.role')}</th>
                      <th className="px-4 py-3 font-semibold">{t('invitations.expires')}</th>
                      <th className="px-4 py-3 font-semibold text-right">
                        {t('invitations.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-anthracite-100">
                    {invitations.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 font-medium text-anthracite-900">
                          {inv.email}
                        </td>
                        <td className="px-4 py-3 text-anthracite-600">
                          {roleLabel(inv.role)}
                        </td>
                        <td className="px-4 py-3 text-anthracite-600">
                          {new Date(inv.expiresAt).toLocaleDateString(locale)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="text-sm text-red-500 hover:underline"
                            onClick={() => void handleRevoke(inv)}
                          >
                            {t('invitations.revoke')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
