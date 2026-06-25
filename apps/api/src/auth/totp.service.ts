import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) szolgáltatás 2FA-hoz, KIZÁRÓLAG a node:crypto-ra építve
 * (nincs új npm függőség). A titok base32-ben tárolódik (User.twoFactorSecret).
 *
 * A szerver NEM renderel QR-képet (nincs extra függőség): az `otpauth://` URI-t
 * és a base32 titkot adjuk vissza, a felhasználó beolvashatja/kézzel beviheti az
 * authenticator appba (Google Authenticator, Authy, stb.).
 */
@Injectable()
export class TotpService {
  private static readonly PERIOD = 30; // másodperc
  private static readonly DIGITS = 6;
  private static readonly ISSUER = 'Valloreg';
  private static readonly B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /** Új véletlen base32 titok (20 byte ≈ 160 bit, az RFC ajánlása szerint). */
  generateSecret(): string {
    return this.base32Encode(randomBytes(20));
  }

  /** otpauth:// URI az authenticator appoknak. */
  buildOtpAuthUri(secret: string, accountLabel: string): string {
    const label = encodeURIComponent(`${TotpService.ISSUER}:${accountLabel}`);
    const params = new URLSearchParams({
      secret,
      issuer: TotpService.ISSUER,
      algorithm: 'SHA1',
      digits: String(TotpService.DIGITS),
      period: String(TotpService.PERIOD),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /**
   * Egy 6 jegyű kód ellenőrzése a titok ellen, ±1 időablakkal (óra-eltérés
   * tolerancia). Konstans idejű összehasonlítás.
   */
  verify(secret: string, token: string): boolean {
    const cleaned = (token ?? '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) return false;

    const key = this.base32Decode(secret);
    if (key.length === 0) return false;

    const counter = Math.floor(Date.now() / 1000 / TotpService.PERIOD);
    for (let offset = -1; offset <= 1; offset++) {
      const expected = this.hotp(key, counter + offset);
      if (this.constantTimeEquals(expected, cleaned)) return true;
    }
    return false;
  }

  /** HOTP (RFC 4226) egy adott számlálóra. */
  private hotp(key: Buffer, counter: number): string {
    const buf = Buffer.alloc(8);
    // 64 bites big-endian számláló (a felső 32 bit a gyakorlatban 0).
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter >>> 0, 4);

    const hmac = createHmac('sha1', key).update(buf).digest();
    const lastByte = hmac[hmac.length - 1];
    if (lastByte === undefined) return '';
    const offset = lastByte & 0x0f;
    const binary =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    const otp = binary % 10 ** TotpService.DIGITS;
    return otp.toString().padStart(TotpService.DIGITS, '0');
  }

  private constantTimeEquals(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  private base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buf) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += TotpService.B32[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      out += TotpService.B32[(value << (5 - bits)) & 31];
    }
    return out;
  }

  private base32Decode(input: string): Buffer {
    const clean = (input ?? '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
      const idx = TotpService.B32.indexOf(ch);
      if (idx === -1) return Buffer.alloc(0); // érvénytelen karakter
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(out);
  }
}
