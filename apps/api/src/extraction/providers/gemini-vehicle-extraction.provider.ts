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
    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      'JSON szerződés (EU-egységes mezőkódok zárójelben):',
      '{',
      '  "plate": string|null,            // rendszám (A)',
      '  "vin": string|null,              // alvázszám / VIN (E)',
      '  "make": string|null,             // gyártmány / marca (D.1)',
      '  "model": string|null,            // kereskedelmi megnevezés (D.3)',
      '  "vehicleType": string|null,      // típus/variáns/verzió (D.2)',
      '  "year": number|null,             // évjárat',
      '  "firstRegistration": "YYYY-MM-DD"|null, // első forgalomba helyezés (B)',
      '  "fuelType": string|null,         // üzemanyag (P.3)',
      '  "engineCm3": number|null,        // hengerűrtartalom cm3 (P.1)',
      '  "powerKw": number|null,          // teljesítmény kW (P.2)',
      '  "color": string|null,            // szín (R)',
      '  "category": string|null,         // jármű-kategória (J – M1, N1, ...)',
      '  "seats": number|null,            // ülőhelyek száma (S.1)',
      '  "maxMassKg": number|null,        // megengedett legnagyobb tömeg kg (F.1)',
      '  "kerbWeightKg": number|null,     // saját tömeg kg (G)',
      '  "euroClass": string|null,        // emissziós osztály / Euro (V.9)',
      '  "typeApproval": string|null,     // típusjóváhagyási szám (K)',
      '  "ownerName": string|null,        // tulajdonos neve (C.2)',
      '  "ownerAddress": string|null,     // tulajdonos címe (C.2)',
      '  "ownerType": "person"|"company"|null, // tulajdonos típusa',
      '  "ownerIdNumber": string|null,    // tulajdonos CNP-je (személy) vagy CUI-ja (cég)',
      '  "userName": string|null,         // üzembentartó / lízingbevevő neve (C.1)',
      '  "userAddress": string|null,      // üzembentartó címe (C.1)',
      '  "userType": "person"|"company"|null, // üzembentartó típusa',
      '  "userIdNumber": string|null,     // üzembentartó CNP-je (személy) vagy CUI-ja (cég)',
      '  "confidence": 0..1,',
      '  "uncertainFields": [{ "path": string, "reason": string, "confidence": 0..1 }]',
      '}',
      '',
      'Szabályok:',
      '- Csak a dokumentumban szereplő adatokat add vissza; ne találj ki értékeket.',
      '- Bizonytalan/hiányzó mező: null + tedd az uncertainFields-be (pl. "vin").',
      '- A rendszámot eredeti formátumban add vissza.',
      '- A tulajdonos (C.2) és az üzembentartó (C.1) gyakran azonos; ha csak egy fél',
      '  szerepel, töltsd ki mindkettőt ugyanazzal, vagy hagyd a user mezőket null-on.',
      '- A típus "company", ha a név cégformát tartalmaz (Kft, Zrt, Bt, SRL, SA, SC, GmbH),',
      '  különben "person". A cég azonosítója CUI/adószám, a személyé CNP.',
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
