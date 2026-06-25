import { Injectable, Logger } from '@nestjs/common';
import {
  ItemCategory,
  ItemType,
  parseExtractionResult,
  PartType,
} from '@valloreg/shared';
import type { ExtractionResult } from '@valloreg/shared';
import { AppConfigService } from '../../config/app-config.service';
import type {
  ExtractionContext,
  ExtractionProvider,
} from '../extraction.provider';

const GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

/** Ezeken a HTTP státuszokon érdemes a következő modellre váltani.
 *  404: kivezetett/ismeretlen modellnév – lépjünk a következőre, ne hasaljon el. */
const FALLBACK_STATUSES = new Set([404, 429, 500, 503]);

/**
 * Google Gemini alapú extraction. OCR szövegből előállítja a shared
 * `ExtractionResult` szerződést, JSON módban (`responseMimeType`).
 *
 * MODELL-LÁNC: a `config.gemini.models` listán megy végig; ha egy modell
 * kvótát/sebességkorlátot dob (429) vagy átmeneti hibát (5xx), automatikusan a
 * KÖVETKEZŐ modellre vált (mindegyiknek külön ingyenes napi kerete van).
 *
 * MEGJEGYZÉS (Fázis 2 bővítés): a Gemini vision a fájlt KÖZVETLENÜL is olvassa
 * (OCR + extraction egy hívásban). Itt az interfész-kompatibilis, OCR-szövegből
 * dolgozó változat van; a vision-os OCR a GeminiOcrProvider feladata lesz.
 */
@Injectable()
export class GeminiExtractionProvider implements ExtractionProvider {
  private readonly logger = new Logger(GeminiExtractionProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async extract(
    ocrText: string,
    ctx: ExtractionContext,
  ): Promise<ExtractionResult> {
    const { apiKey, models } = this.config.gemini;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY hiányzik – az extraction provider nem tud Gemini-t hívni.',
      );
    }

    const prompt = this.buildPrompt(ocrText, ctx.locale);
    let lastError: Error | undefined;

    for (const model of models) {
      try {
        const json = await this.callModel(model, prompt, apiKey);
        // A shared séma a single source of truth – validál + kitölti a defaultokat.
        return parseExtractionResult(json);
      } catch (err) {
        lastError = err as Error;
        const status = (err as { status?: number }).status;
        if (status && FALLBACK_STATUSES.has(status)) {
          this.logger.warn(
            `Gemini modell "${model}" elérte a limitet/hibát (${status}) – váltás a következőre.`,
          );
          continue;
        }
        // Nem fallback-jellegű hiba (pl. érvénytelen válasz): tovább dobjuk.
        throw err;
      }
    }

    throw new Error(
      `Minden Gemini modell elérte a kvótát/hibát. Utolsó hiba: ${lastError?.message ?? 'ismeretlen'}`,
    );
  }

  /** Egyetlen modell hívása; JSON szöveget ad vissza (még nem validált). */
  private async callModel(
    model: string,
    prompt: string,
    apiKey: string,
  ): Promise<unknown> {
    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = new Error(
        `Gemini hívás sikertelen (${model}): ${res.status} ${body.slice(0, 300)}`,
      ) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Gemini üres választ adott (${model}).`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Gemini nem JSON-t adott vissza (${model}).`);
    }
  }

  /** A strukturált prompt felépítése a shared enumokra alapozva. */
  private buildPrompt(ocrText: string, locale?: string): string {
    const categories = Object.values(ItemCategory).join(', ');
    const types = Object.values(ItemType).join(', ');
    const partTypes = Object.values(PartType).join(', ');

    return [
      'Egy fuvarozó cég feltöltött dokumentumát dolgozod fel. A bemenet egy fájl OCR',
      'szövege (magyar, román vagy angol nyelven). ELŐSZÖR osztályozd a dokumentumot,',
      'majd ha szervizszámla, olvasd ki a számlaadatokat. Adj vissza KIZÁRÓLAG egy',
      'JSON objektumot az alábbi szerződés szerint, magyarázat nélkül.',
      '',
      'Osztályozás ("documentType"):',
      '- "invoice": szervizszámla / számla (van beszállító, tételek, összegek).',
      '- "registration": forgalmi engedély / jármű-regisztráció (rendszám, VIN).',
      '- "compliance": megfelelőségi igazolás (ITP/műszaki, RCA/biztosítás, matrica).',
      '- "other": minden egyéb / nem felismert.',
      'Ha NEM "invoice", az invoice/items mezőket hagyd üresen/alapértelmezetten.',
      '',
      'JSON szerződés:',
      '{',
      '  "documentType": "invoice"|"registration"|"compliance"|"other",',
      '  "invoice": {',
      '    "supplier": string, "date": "YYYY-MM-DD"|"", "invoiceNumber": string,',
      '    "currency": "RON"|"EUR"|"HUF"|..., "odometerKm": number|null,',
      '    "netTotal": number|null, "taxTotal": number|null, "grossTotal": number|null,',
      '    "vehicleCandidates": [{ "plate": string|null, "vin": string|null,',
      '      "vehicleId": null, "source": "plate"|"vin"|"supplier_pattern"|"history"|"manual",',
      '      "confidence": 0..1 }],',
      '    "confidence": 0..1',
      '  },',
      '  "items": [{ "name": string,',
      `    "category": one of [${categories}],`,
      `    "partType": one of [${partTypes}] or null,`,
      `    "type": one of [${types}],`,
      '    "articleNumber": string|null,',
      '    "vehicleId": null, "quantity": number, "unitPrice": number|null,',
      '    "price": number, "confidence": 0..1 }],',
      '  "uncertainFields": [{ "path": string, "reason": string, "confidence": 0..1 }]',
      '}',
      '',
      'Szabályok:',
      '- Először mindig döntsd el a "documentType" értékét a tartalom alapján.',
      '- Csak a számlán szereplő adatokat add vissza; ne találj ki értékeket.',
      '- Bizonytalan/hiányzó mező: tedd az uncertainFields-be (pl. "invoice.date").',
      '- A "type" "vehicle", ha a tétel konkrét járműhöz tartozik; "tool" szerszám/',
      '  műhelyfelszerelés; "general" általános/iroda/flotta költség.',
      '- "articleNumber": az alkatrész cikkszáma/cikkkódja (OEM- vagy gyártói szám),',
      '  PONTOSAN ahogy a számlán szerepel; ha nincs ilyen, null. Ne a megnevezés.',
      '- A confidence 0 és 1 között a saját biztonságodat tükrözze.',
      locale ? `- Elsődleges nyelvi hint: ${locale}.` : '',
      '',
      'OCR szöveg:',
      '"""',
      ocrText,
      '"""',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
