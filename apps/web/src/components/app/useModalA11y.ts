'use client';

import { useEffect, useRef } from 'react';

/**
 * Minimális, konzisztens modal-akadálymentesség:
 * - Escape billentyűre bezár,
 * - a kezdeti fókuszt a dialógusra (vagy az első fókuszálható elemére) viszi.
 *
 * Használat: a visszaadott ref-et tedd a dialógus konténerére, és add át az
 * `onClose` callbacket. A konténerre kézzel kell tenni role="dialog"
 * aria-modal="true" tabIndex={-1} attribútumokat (lásd a modal-komponenseket).
 */
export function useModalA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    // Az első fókuszálható elemet keressük; ha nincs, magát a dialógust fókuszáljuk.
    const focusable = node.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? node).focus();
  }, []);

  return dialogRef;
}
