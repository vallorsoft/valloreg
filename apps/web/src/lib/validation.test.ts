import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isNonEmpty,
  isValidPassword,
  isValidTaxId,
} from './validation';

describe('isValidEmail', () => {
  it('érvényes e-mail címeket elfogad', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a.b@sub.domain.hu')).toBe(true);
  });

  it('a körülvevő whitespace-t trimmeli', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });

  it('@ jel nélkül elutasít', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('domain pont nélkül elutasít', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('belső whitespace esetén elutasít', () => {
    expect(isValidEmail('us er@example.com')).toBe(false);
  });

  it('üres stringre false', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('érvényes nemzetközi formátumot elfogad', () => {
    expect(isValidPhone('+40 712 345 678')).toBe(true);
    expect(isValidPhone('(021) 123-4567')).toBe(true);
  });

  it('a körülvevő whitespace-t trimmeli', () => {
    expect(isValidPhone('  0712345678  ')).toBe(true);
  });

  it('túl rövid (< 6 karakter) számot elutasít', () => {
    expect(isValidPhone('12345')).toBe(false);
  });

  it('túl hosszú (> 20 karakter) számot elutasít', () => {
    expect(isValidPhone('123456789012345678901')).toBe(false);
  });

  it('nem engedélyezett karakterre (betű) false', () => {
    expect(isValidPhone('0712abc678')).toBe(false);
  });
});

describe('isNonEmpty', () => {
  it('nem üres szövegre true', () => {
    expect(isNonEmpty('valami')).toBe(true);
  });

  it('üres stringre false', () => {
    expect(isNonEmpty('')).toBe(false);
  });

  it('csak whitespace-re false (trimmel)', () => {
    expect(isNonEmpty('   ')).toBe(false);
    expect(isNonEmpty('\t\n')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('legalább 8 karakter hosszú jelszót elfogad', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('hosszabb-jelszo')).toBe(true);
  });

  it('8-nál rövidebb jelszót elutasít', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });

  it('nem trimmel (a whitespace is karakternek számít)', () => {
    expect(isValidPassword('        ')).toBe(true);
  });
});

describe('isValidTaxId', () => {
  it('legalább 6 számjegyet tartalmazó értéket elfogad', () => {
    expect(isValidTaxId('123456')).toBe(true);
    expect(isValidTaxId('RO12345678')).toBe(true);
  });

  it('a nem-számjegy karaktereket figyelmen kívül hagyja', () => {
    expect(isValidTaxId('12-34-56')).toBe(true);
  });

  it('6-nál kevesebb számjegyre false', () => {
    expect(isValidTaxId('12345')).toBe(false);
    expect(isValidTaxId('RO-1234')).toBe(false);
    expect(isValidTaxId('')).toBe(false);
  });
});
