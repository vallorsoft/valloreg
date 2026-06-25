import { Injectable, Logger } from '@nestjs/common';
import { parseVehicleRegistration } from '@valloreg/shared';
import type { VehicleRegistrationResult } from '@valloreg/shared';
import { AppConfigService } from '../../config/app-config.service';
import type {
  VehicleExtractionContext,
  VehicleExtractionProvider,
} from '../vehicle-extraction.provider';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_STATUSES = new Set([429, 500, 503]);

/**
 * Gemini alapú forgalmi-engedély kiolvasás. OCR szövegből a shared
 * `VehicleRegistrationResult` JSON-t állítja elő (JSON módban). Modell-lánccal:
 * 429/5xx esetén a következő modellre vált.
 */
@Injectable()
export class GeminiVehicleExtractionProvider
  implements VehicleExtractionProvider
{
  private readonly logger = new Logger(GeminiVehicleExtractionProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async extractVehicle(
    ocrText: string,
    ctx: VehicleExtractionContext,
  ): Promise<VehicleRegistrationResult> {
    const { apiKey, models } = this.config.gemini;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY hiányzik – a jármű-extraction nem tud Gemini-t hívni.',
      );
    }

    const prompt = this.buildPrompt(ocrText, ctx.locale);
    let lastError: Error | undefined;

    for (const model of models) {
      try {
        const json = await this.callModel(model, prompt, apiKey);
        return parseVehicleRegistration(json);
      } catch (err) {
        lastError = err as Error;
        const status = (err as { status?: number }).status;
        if (status && FALLBACK_STATUSES.has(status)) {
          this.logger.warn(
            `Gemini modell "${model}" limit/hiba (${status}) – váltás a következőre.`,
          );
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Minden Gemini modell elérte a kvótát/hibát. Utolsó hiba: ${lastError?.message ?? 'ismeretlen'}`,
    );
  }

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
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
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
    if (!text) throw new Error(`Gemini üres választ adott (${model}).`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Gemini nem JSON-t adott vissza (${model}).`);
    }
  }

  private buildPrompt(ocrText: string, locale?: string): string {
    return [
      'Egy jármű forgalmi engedélyét (HU "forgalmi engedély", RO "certificat de',
      'înmatriculare", EN "vehicle registration certificate") dolgozod fel. A bemenet',
      'a dokumentum OCR szövege. Adj vissza KIZÁRÓLAG egy JSON objektumot az alábbi',
      'szerződés szerint, magyarázat nélkül.',
      '',
      'JSON szerződés:',
      '{',
      '  "plate": string|null,            // rendszám',
      '  "vin": string|null,              // alvázszám / VIN (HU "E" mező)',
      '  "make": string|null,             // gyártmány (marca)',
      '  "model": string|null,            // típus / kereskedelmi megnevezés',
      '  "year": number|null,             // évjárat',
      '  "firstRegistration": "YYYY-MM-DD"|null, // első forgalomba helyezés',
      '  "fuelType": string|null,         // üzemanyag',
      '  "engineCm3": number|null,        // hengerűrtartalom cm3',
      '  "powerKw": number|null,          // teljesítmény kW',
      '  "color": string|null,            // szín',
      '  "category": string|null,         // jármű-kategória (M1, N1, ...)',
      '  "ownerName": string|null,        // tulajdonos neve',
      '  "confidence": 0..1,',
      '  "uncertainFields": [{ "path": string, "reason": string, "confidence": 0..1 }]',
      '}',
      '',
      'Szabályok:',
      '- Csak a dokumentumban szereplő adatokat add vissza; ne találj ki értékeket.',
      '- Bizonytalan/hiányzó mező: null + tedd az uncertainFields-be (pl. "vin").',
      '- A rendszámot eredeti formátumban add vissza.',
      '- A confidence a saját biztonságodat tükrözze 0 és 1 között.',
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
