'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  isAllowedDocumentMimeType,
  MAX_DOCUMENT_SIZE_BYTES,
} from '@valloreg/shared';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { documentsApi, ApiError } from '@/lib/api';
import type { DocumentListItem } from '@/lib/api';

const ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const ACCEPT_HINT = ALLOWED_DOCUMENT_EXTENSIONS.join(', ');

/** Már lokalizált üzenetet hordozó kliensoldali validációs hiba. */
class UploadError extends Error {}

/** Egy fájl feltöltési állapota a tömeges feltöltőben. */
type FileStatus = 'uploading' | 'done' | 'error';

interface UploadItem {
  name: string;
  status: FileStatus;
  /** Hibaüzenet (csak `error` állapotban). */
  message?: string;
}

interface Props {
  onUploadComplete?: (doc: DocumentListItem) => void;
}

export function UploadZone({ onUploadComplete }: Props) {
  const t = useTranslations('documents.upload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  function setItemAt(index: number, patch: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    // Minden fájl külön sorként jelenik meg, induló állapotban "uploading".
    const startIndex = items.length;
    setItems((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, status: 'uploading' as FileStatus })),
    ]);
    setUploading(true);

    // Soros feldolgozás: minden fájl a saját sorát frissíti (fájlonkénti státusz).
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const index = startIndex + i;
      const mimeType = file.type || 'application/octet-stream';
      try {
        // Kliensoldali validáció: azonnali, lokalizált visszajelzés.
        if (!isAllowedDocumentMimeType(mimeType)) {
          throw new UploadError(t('errorUnsupported'));
        }
        if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
          throw new UploadError(t('errorTooLarge'));
        }

        const doc = await documentsApi.upload(file);
        setItemAt(index, { status: 'done' });
        onUploadComplete?.(doc);
      } catch (err) {
        const message =
          err instanceof ApiError || err instanceof UploadError
            ? err.message
            : t('errorGeneric');
        setItemAt(index, { status: 'error', message });
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors',
          dragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-anthracite-200',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xl"
        >
          {uploading ? '⏳' : '↑'}
        </span>
        <div>
          <p className="font-semibold text-anthracite-900">
            {uploading ? t('uploading') : t('title')}
          </p>
          <p className="text-sm text-anthracite-500">{t('description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {t('button')}
        </Button>
        <p className="text-xs text-anthracite-400">
          {t('hint')} ({ACCEPT_HINT})
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Fájlonkénti státusz (tömeges feltöltés). */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-anthracite-100 bg-white px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-anthracite-800">
                {it.name}
              </span>
              {it.status === 'uploading' && (
                <span className="shrink-0 text-xs text-anthracite-500">
                  ⏳ {t('status.uploading')}
                </span>
              )}
              {it.status === 'done' && (
                <span className="shrink-0 text-xs font-medium text-green-600">
                  ✓ {t('status.done')}
                </span>
              )}
              {it.status === 'error' && (
                <span className="shrink-0 text-xs font-medium text-red-600">
                  ✕ {it.message ?? t('status.error')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
