'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from '@valloreg/shared';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const ACCEPT_HINT = ALLOWED_DOCUMENT_EXTENSIONS.join(', ');

/**
 * Drag & drop upload zone skeleton.
 *
 * TODO (later phase): request a presigned URL from the API and upload directly
 * to S3, then create the Document record. For now selected files are ignored.
 */
export function UploadZone() {
  const t = useTranslations('documents.upload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(_files: FileList | null) {
    // No-op in Phase 1. Wiring lands later (see component TODO).
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors',
        dragging
          ? 'border-primary-500 bg-primary-50'
          : 'border-anthracite-200',
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700"
      >
        ↑
      </span>
      <div>
        <p className="font-semibold text-anthracite-900">{t('title')}</p>
        <p className="text-sm text-anthracite-500">{t('description')}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
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
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
