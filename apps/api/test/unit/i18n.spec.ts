/**
 * Az i18n szótárak TELJESSÉGÉT és a hibakód-lefedettséget ellenőrző unit tesztek.
 *
 * Két invariánst véd:
 *  1. KULCS-PARITÁS: a `hu` / `ro` / `en` szótárak mélységi (nested, dot-notation)
 *     kulcskészlete pontosan azonos. A `hu` az alapértelmezett referencia.
 *  2. HIBAKÓD-LEFEDETTSÉG: a `@valloreg/shared` `ErrorCode` minden értékéhez tartozik
 *     fordítási kulcs MINDHÁROM nyelvben, az `auth.errors` blokk alatt (ide i18n-eli
 *     a frontend a gépi hibakódokat).
 *
 * NINCS Prisma kliens és NINCS NestJS – tisztán a JSON szótárakat és a shared
 * konstansokat olvassa, hogy a generált kliens nélkül is fusson.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorCode } from '@valloreg/shared';

type Json = Record<string, unknown>;

// A teszt az `apps/api`-ból fut; a web messages az `apps/web/src/messages` alatt van.
// `__dirname` = apps/api/test/unit → onnan három szint fel a repo `apps/`-ig.
const MESSAGES_DIR = join(__dirname, '..', '..', '..', 'web', 'src', 'messages');

function loadDict(locale: string): Json {
  const file = join(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Json;
}

/**
 * Rekurzívan összegyűjti a szótár leveleinek dot-notation kulcsait.
 * (Levél = string vagy nem-objektum érték; a tömböket nem bontjuk tovább.)
 */
function collectKeys(obj: unknown, prefix = '', acc = new Set<string>()): Set<string> {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj as Json)) {
      const path = prefix ? `${prefix}.${key}` : key;
      collectKeys(value, path, acc);
    }
  } else {
    acc.add(prefix);
  }
  return acc;
}

/** Beágyazott `errors` blokk az `auth` alatt: ide kerülnek a gépi hibakódok. */
function errorKeys(dict: Json): Set<string> {
  const auth = dict.auth as Json | undefined;
  const errors = auth?.errors as Json | undefined;
  return new Set(errors ? Object.keys(errors) : []);
}

const LOCALES = ['hu', 'ro', 'en'] as const;
const dicts: Record<(typeof LOCALES)[number], Json> = {
  hu: loadDict('hu'),
  ro: loadDict('ro'),
  en: loadDict('en'),
};

const keySets = {
  hu: collectKeys(dicts.hu),
  ro: collectKeys(dicts.ro),
  en: collectKeys(dicts.en),
};

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

describe('i18n szótárak teljessége', () => {
  it('mindhárom szótár betölthető és nem üres', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(dicts[locale]).length).toBeGreaterThan(0);
    }
  });

  it('a hibakódok az auth.errors blokk alatt vannak (struktúra-feltevés)', () => {
    expect(typeof dicts.hu.auth).toBe('object');
    expect(typeof (dicts.hu.auth as Json).errors).toBe('object');
  });

  describe('KULCS-PARITÁS (mélységi, dot-notation)', () => {
    it('hu ↔ ro kulcskészlete azonos', () => {
      const missingInRo = diff(keySets.hu, keySets.ro);
      const extraInRo = diff(keySets.ro, keySets.hu);
      expect({ missingInRo, extraInRo }).toEqual({ missingInRo: [], extraInRo: [] });
    });

    it('hu ↔ en kulcskészlete azonos', () => {
      const missingInEn = diff(keySets.hu, keySets.en);
      const extraInEn = diff(keySets.en, keySets.hu);
      expect({ missingInEn, extraInEn }).toEqual({ missingInEn: [], extraInEn: [] });
    });
  });

  describe('HIBAKÓD-LEFEDETTSÉG (@valloreg/shared ErrorCode)', () => {
    const codes = Object.values(ErrorCode);

    it('van legalább egy ErrorCode és mindegyik egyedi string', () => {
      expect(codes.length).toBeGreaterThan(0);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('minden ErrorCode szerepel mindhárom nyelv auth.errors blokkjában', () => {
      const errorsByLocale = {
        hu: errorKeys(dicts.hu),
        ro: errorKeys(dicts.ro),
        en: errorKeys(dicts.en),
      };

      const missing: Array<{ code: string; locale: string }> = [];
      for (const code of codes) {
        for (const locale of LOCALES) {
          if (!errorsByLocale[locale].has(code)) {
            missing.push({ code, locale });
          }
        }
      }

      expect(missing).toEqual([]);
    });
  });
});
