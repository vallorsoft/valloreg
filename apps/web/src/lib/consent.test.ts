import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConsent,
  hasMarketingConsent,
  CONSENT_STORAGE_KEY,
  type ConsentState,
} from './consent';

function store(state: unknown): void {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
}

const validState: ConsentState = {
  v: 1,
  necessary: true,
  functional: true,
  marketing: true,
  ts: '2026-06-26T00:00:00.000Z',
};

describe('getConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tárolt érték nélkül null-t ad', () => {
    expect(getConsent()).toBeNull();
  });

  it('érvényes tárolt JSON-t visszafejt a megfelelő mezőkkel', () => {
    store(validState);
    const consent = getConsent();
    expect(consent).not.toBeNull();
    expect(consent?.marketing).toBe(true);
    expect(consent?.functional).toBe(true);
    expect(consent?.necessary).toBe(true);
    expect(consent?.v).toBe(1);
  });

  it('hibás / parse-olhatatlan JSON esetén biztonságosan null-t ad (nem dob)', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, '{nem-valid-json');
    expect(() => getConsent()).not.toThrow();
    expect(getConsent()).toBeNull();
  });
});

describe('hasMarketingConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tárolt érték nélkül false', () => {
    expect(hasMarketingConsent()).toBe(false);
  });

  it('marketing=true tárolt értéknél true', () => {
    store(validState);
    expect(hasMarketingConsent()).toBe(true);
  });

  it('marketing=false tárolt értéknél false', () => {
    store({ ...validState, marketing: false });
    expect(hasMarketingConsent()).toBe(false);
  });

  it('hibás JSON esetén biztonságosan false (nem dob)', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'xxx');
    expect(() => hasMarketingConsent()).not.toThrow();
    expect(hasMarketingConsent()).toBe(false);
  });
});
