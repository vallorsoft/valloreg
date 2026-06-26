import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('üres bemenetre üres stringet ad', () => {
    expect(cn()).toBe('');
  });

  it('falsy értékeket (false/null/undefined/0/empty) kiszűr', () => {
    expect(cn(false, null, undefined, 0, '')).toBe('');
  });

  it('a megmaradó osztályneveket szóközzel join-olja', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('a falsy értékeket kihagyja, csak a truthy-kat tartja meg', () => {
    expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });

  it('feltételes (rövidzár) osztálynevet kezel', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe(
      'base active',
    );
  });

  it('numerikus truthy értéket stringgé alakít', () => {
    expect(cn('a', 1, 'b')).toBe('a 1 b');
  });
});
