/**
 * Tiny class-name combiner (no external deps).
 * Filters falsy values and joins with a space.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
