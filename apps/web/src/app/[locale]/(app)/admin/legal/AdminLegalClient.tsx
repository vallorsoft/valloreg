'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  LEGAL_CATEGORIES,
  LEGAL_DOWNLOAD_FORMATS,
  type LegalCategory,
  type LegalDocContent,
  type LegalDocListItem,
  type LegalDocRecord,
  type LegalDownloadFormat,
} from '@valloreg/shared';
import { adminApi, ApiError, type AdminTenantListItem } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { LoadErrorState, isRealLoadError } from '@/components/app/LoadErrorState';
import { Link } from '@/i18n/routing';

export function AdminLegalClient() {
  const t = useTranslations('adminLegal');

  const [docs, setDocs] = useState<LegalDocListItem[]>([]);
  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Globális (lista-szintű) visszajelzés.
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Épp publikálás-váltás alatt lévő slug-ok.
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  // Szerkesztő állapota.
  const [selected, setSelected] = useState<LegalDocRecord | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    summary: '',
    updated: '',
    blocks: '',
  });
  const [downloading, setDownloading] = useState<LegalDownloadFormat | null>(null);

  // Cégnek küldés állapota.
  const [sendTenantId, setSendTenantId] = useState('');
  const [sendFormat, setSendFormat] = useState<LegalDownloadFormat>('pdf');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    setForbidden(false);
    setLoading(true);
    Promise.all([adminApi.legalList(), adminApi.listTenants()])
      .then(([list, tenantList]) => {
        setDocs(list);
        setTenants(tenantList);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else if (isRealLoadError(err)) {
          setLoadError(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleVisibility(slug: string, nextPublic: boolean) {
    setError(null);
    setNotice(null);
    setTogglingSlug(slug);
    try {
      const rec = await adminApi.legalSetVisibility(slug, nextPublic);
      setDocs((prev) => prev.map((d) => (d.slug === slug ? { ...d, isPublic: rec.isPublic } : d)));
      setSelected((prev) =>
        prev && prev.slug === slug ? { ...prev, isPublic: rec.isPublic } : prev,
      );
      setNotice(rec.isPublic ? t('visibility.nowPublic') : t('visibility.nowInternal'));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : t('visibility.error'));
    } finally {
      setTogglingSlug(null);
    }
  }

  async function handleSelect(slug: string) {
    setEditError(null);
    setEditNotice(null);
    setEditLoading(true);
    setSelected(null);
    try {
      const rec = await adminApi.legalGet(slug);
      setSelected(rec);
      setForm({
        title: rec.title,
        subtitle: rec.subtitle ?? '',
        summary: rec.summary,
        updated: rec.updated,
        blocks: JSON.stringify(rec.blocks, null, 2),
      });
    } catch (err) {
      setEditError(err instanceof ApiError ? err.code : t('editor.loadError'));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setEditError(null);
    setEditNotice(null);

    // A blocks textarea JSON-ja – érvénytelen JSON esetén NEM küldünk.
    let parsedBlocks: LegalDocRecord['blocks'];
    try {
      parsedBlocks = JSON.parse(form.blocks);
    } catch {
      setEditError(t('editor.invalidJson'));
      return;
    }
    if (!Array.isArray(parsedBlocks)) {
      setEditError(t('editor.invalidJson'));
      return;
    }

    const payload: LegalDocContent = {
      title: form.title,
      subtitle: form.subtitle.trim() === '' ? null : form.subtitle,
      summary: form.summary,
      updated: form.updated,
      blocks: parsedBlocks,
    };

    setSaving(true);
    try {
      const rec = await adminApi.legalUpdate(selected.slug, payload);
      setSelected(rec);
      setForm({
        title: rec.title,
        subtitle: rec.subtitle ?? '',
        summary: rec.summary,
        updated: rec.updated,
        blocks: JSON.stringify(rec.blocks, null, 2),
      });
      setDocs((prev) =>
        prev.map((d) =>
          d.slug === rec.slug
            ? {
                ...d,
                title: rec.title,
                subtitle: rec.subtitle ?? null,
                summary: rec.summary,
                updated: rec.updated,
                isPublic: rec.isPublic,
              }
            : d,
        ),
      );
      setEditNotice(t('editor.saved'));
    } catch (err) {
      setEditError(err instanceof ApiError ? err.code : t('editor.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(format: LegalDownloadFormat) {
    if (!selected) return;
    setEditError(null);
    setDownloading(format);
    try {
      const blob = await adminApi.legalDownload(selected.slug, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected.slug}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.code : t('download.error'));
    } finally {
      setDownloading(null);
    }
  }

  async function handleSend() {
    if (!selected || sendTenantId === '') return;
    setEditError(null);
    setEditNotice(null);
    setSending(true);
    try {
      const res = await adminApi.legalSend(selected.slug, sendTenantId, sendFormat);
      if (res.ok) {
        setEditNotice(t('send.ok', { to: res.to }));
      } else {
        setEditError(t('send.fail', { to: res.to }));
      }
    } catch (err) {
      setEditError(err instanceof ApiError ? err.code : t('send.error'));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  if (forbidden) {
    return <div className="py-16 text-center text-sm text-anthracite-600">{t('forbidden')}</div>;
  }

  if (loadError) {
    return (
      <>
        <PageHeading title={t('title')} subtitle={t('subtitle')} />
        <LoadErrorState onRetry={load} />
      </>
    );
  }

  // Dokumentumok kategóriánként, a LEGAL_CATEGORIES sorrendjében.
  const docsByCategory = (category: LegalCategory) => docs.filter((d) => d.category === category);

  return (
    <>
      <div className="mb-4">
        <Link href="/admin" className="text-sm text-primary-600 hover:underline">
          ← {t('backToAdmin')}
        </Link>
      </div>

      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 text-sm text-green-600">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista – kategóriánként */}
        <div className="space-y-6">
          {LEGAL_CATEGORIES.map((cat) => {
            const items = docsByCategory(cat.key);
            if (items.length === 0) return null;
            return (
              <Card key={cat.key} className="overflow-hidden p-0">
                <div className="border-b border-anthracite-100 px-4 py-3">
                  <h2 className="text-base font-semibold text-anthracite-900">
                    {t(`categories.${cat.key}` as Parameters<typeof t>[0])}
                  </h2>
                </div>
                <ul className="divide-y divide-anthracite-100">
                  {items.map((doc) => (
                    <li
                      key={doc.slug}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => void handleSelect(doc.slug)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span
                          className={
                            selected?.slug === doc.slug
                              ? 'block truncate font-medium text-primary-700'
                              : 'block truncate font-medium text-anthracite-900 hover:text-primary-700'
                          }
                        >
                          {doc.title}
                        </span>
                        <span className="block truncate text-xs text-anthracite-400">
                          {doc.slug}
                        </span>
                      </button>
                      <span
                        className={
                          doc.isPublic
                            ? 'shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                            : 'shrink-0 rounded-full bg-anthracite-100 px-2 py-0.5 text-xs font-medium text-anthracite-600'
                        }
                      >
                        {doc.isPublic ? t('badge.public') : t('badge.internal')}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={togglingSlug === doc.slug}
                        onClick={() => void handleToggleVisibility(doc.slug, !doc.isPublic)}
                      >
                        {togglingSlug === doc.slug
                          ? t('visibility.working')
                          : doc.isPublic
                            ? t('visibility.unpublish')
                            : t('visibility.publish')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          {docs.length === 0 && (
            <Card>
              <p className="text-sm text-anthracite-500">{t('empty')}</p>
            </Card>
          )}
        </div>

        {/* Szerkesztő */}
        <div className="space-y-6">
          {editLoading ? (
            <Card>
              <p className="text-sm text-anthracite-500">{t('loading')}</p>
            </Card>
          ) : !selected ? (
            <Card>
              <p className="text-sm text-anthracite-500">{t('editor.placeholder')}</p>
            </Card>
          ) : (
            <>
              <Card>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-anthracite-900">
                    {t('editor.title')}
                  </h2>
                  <span className="text-xs text-anthracite-400">{selected.slug}</span>
                </div>

                {editError && <p className="mb-3 text-sm text-red-600">{editError}</p>}
                {editNotice && <p className="mb-3 text-sm text-green-600">{editNotice}</p>}

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('editor.fields.title')}
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('editor.fields.subtitle')}
                    </label>
                    <input
                      type="text"
                      value={form.subtitle}
                      onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                      className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('editor.fields.summary')}
                    </label>
                    <input
                      type="text"
                      value={form.summary}
                      onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                      className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('editor.fields.updated')}
                    </label>
                    <input
                      type="text"
                      value={form.updated}
                      onChange={(e) => setForm((f) => ({ ...f, updated: e.target.value }))}
                      className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('editor.fields.blocks')}
                    </label>
                    <textarea
                      value={form.blocks}
                      onChange={(e) => setForm((f) => ({ ...f, blocks: e.target.value }))}
                      spellCheck={false}
                      rows={16}
                      className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 font-mono text-xs text-anthracite-900"
                    />
                    <p className="mt-1 text-xs text-anthracite-400">{t('editor.blocksHint')}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-anthracite-100 pt-4">
                  <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? t('editor.saving') : t('editor.save')}
                  </Button>
                </div>
              </Card>

              {/* Letöltés */}
              <Card>
                <h2 className="mb-3 text-base font-semibold text-anthracite-900">
                  {t('download.title')}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {LEGAL_DOWNLOAD_FORMATS.map((format) => (
                    <Button
                      key={format}
                      size="sm"
                      variant="outline"
                      disabled={downloading !== null}
                      onClick={() => void handleDownload(format)}
                    >
                      {downloading === format
                        ? t('download.working')
                        : t(`download.formats.${format}` as Parameters<typeof t>[0])}
                    </Button>
                  ))}
                </div>
              </Card>

              {/* Cégnek küldés */}
              <Card>
                <h2 className="mb-3 text-base font-semibold text-anthracite-900">
                  {t('send.title')}
                </h2>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('send.tenant')}
                    </label>
                    <select
                      value={sendTenantId}
                      onChange={(e) => setSendTenantId(e.target.value)}
                      className="w-full rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                    >
                      <option value="">{t('send.tenantPlaceholder')}</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-anthracite-500">
                      {t('send.format')}
                    </label>
                    <select
                      value={sendFormat}
                      onChange={(e) => setSendFormat(e.target.value as LegalDownloadFormat)}
                      className="rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
                    >
                      {LEGAL_DOWNLOAD_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {t(`download.formats.${format}` as Parameters<typeof t>[0])}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void handleSend()}
                    disabled={sending || sendTenantId === ''}
                  >
                    {sending ? t('send.sending') : t('send.send')}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
