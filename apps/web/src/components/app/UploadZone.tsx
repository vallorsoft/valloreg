'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from '@valloreg/shared';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { documentsApi, computeSha256, ApiError } from '@/lib/api';
import type { DocumentListItem } from '@/lib/api';

const ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const ACCEPT_HINT = ALLOWED_DOCUMENT_EXTENSIONS.join(', ');

interface Props {
  onUploadComplete?: (doc: DocumentListItem) => void;
}

export function UploadZone({ onUploadComplete }: Props) {
  const t = useTranslations('documents.upload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // 1. Presigned PUT URL kérése
        const { uploadUrl, storageKey } = await documentsApi.presign({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
        });

        // 2. Közvetlen feltöltés S3/R2-re
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!putRes.ok) {
          throw new Error(t('errorUpload'));
        }

        // 3. SHA-256 számítása (idempotencia)
        const sha256 = await computeSha256(file);

        // 4. Dokumentum regisztrálása + feldolgozás indítása
        const doc = await documentsApi.register({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          storageKey,
          sha256,
        });

        onUploadComplete?.(doc);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
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
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
