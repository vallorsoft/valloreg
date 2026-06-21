import { cn } from '@/lib/cn';

/** Wordmark with a small brand glyph. Decorative mark is aria-hidden. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
      >
        V
      </span>
      <span className="text-lg font-bold tracking-tight text-anthracite-900">
        Valloreg
      </span>
    </span>
  );
}
