/** Lightweight, dependency-free client-side validators for Phase 1 forms. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Permissive international phone check: digits, spaces, +, -, parentheses.
const PHONE_RE = /^[+]?[\d\s()-]{6,20}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

/** Loose tax-id check: must contain at least 6 digits. */
export function isValidTaxId(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 6;
}
