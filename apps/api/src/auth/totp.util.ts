import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Függőség-mentes TOTP (RFC 6238) implementáció kizárólag a `node:crypto`
 * felhasználásával. Authenticator appokkal kompatibilis: HMAC-SHA1, 6 számjegy,
 * 30 másodperces lépés.
 *
 * RFC 6238 ellenőrző vektor (sanity check):
 *   ASCII secret "12345678901234567890" → Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".
 *   T = 59s (counter = 1, step = 30s) → SHA1 TOTP kód (6 számjegy) = "287082".
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

/** 20 random bájt → Base32 (RFC 4648, padding nélkül). Új TOTP secret. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Bájtok → Base32 string (RFC 4648, NINCS '=' padding). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Base32 string (padding/whitespace toleráns, kis/nagybetű) → bájtok. */
export function base32Decode(secret: string): Buffer {
  // A '=' paddinget és a szóközöket eldobjuk, és nagybetűsítünk.
  const clean = secret.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      // Érvénytelen karakter → üres puffer (a verifyTotp false-ra fut majd).
      return Buffer.alloc(0);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Egy adott időlépéshez tartozó TOTP kód (RFC 6238).
 * @param forStep – kifejezett lépés-szám; alapból az aktuális (unix / 30s).
 */
export function totpCode(secret: string, forStep?: number): string {
  const key = base32Decode(secret);
  const step =
    forStep ?? Math.floor(Date.now() / 1000 / STEP_SECONDS);

  // 8 bájtos big-endian számláló a lépésből.
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const hmac = createHmac('sha1', key).update(counter).digest();

  // Dinamikus csonkolás (RFC 4226 §5.3). A SHA1 digest 20 bájt, offset ≤ 15,
  // így offset+3 ≤ 18 < 20 – a bájtok mindig léteznek (a `!` biztonságos).
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

/**
 * TOTP kód ellenőrzése. A `window` paraméter óraeltérés-toleranciát ad:
 * a now-window .. now+window lépésekre is elfogadja a kódot.
 * Konstans-idejű összehasonlítás; a nem 6-számjegyű bemenetet elutasítja.
 */
export function verifyTotp(
  secret: string,
  token: string,
  window = 1,
): boolean {
  if (!secret || !/^\d{6}$/.test(token)) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const expected = Buffer.from(token, 'utf8');

  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(totpCode(secret, currentStep + i), 'utf8');
    // Azonos hosszúságúak (mindkettő 6 jegy), így a timingSafeEqual biztonságos.
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * otpauth:// URI az authenticator app QR-kódjához.
 * Formátum: otpauth://totp/{issuer}:{account}?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30
 */
export function buildOtpauthUrl(
  secret: string,
  account: string,
  issuer = 'Valloreg',
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
