import { Injectable, Logger } from '@nestjs/common';
import { parseComplianceExtraction } from '@valloreg/shared';
import type { ComplianceExtractionResult } from '@valloreg/shared';
import { AppConfigService } from '../../config/app-config.service';
import type {
  ComplianceExtractionContext,
  ComplianceExtractionProvider,
} from '../compliance-extraction.provider';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// 404 is fallback: kivezetett/ismeretlen modellnévnél lépjünk a következőre.
const FALLBACK_STATUSES = new Set([404, 429, 500, 503]);

/**
 * Gemini alapú megfelelőség-kiolvasás: ITP/RCA/rovinietă igazolás OCR
 * szövegéből a lejárati dátum (JSON módban, modell-lánccal).
 */
@Injectable()
export class GeminiComplianceExtractionProvider
  implements ComplianceExtractionProvider
{
  private readonly logger = new Logger(GeminiComplianceExtractionProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async extractCompliance(
    ocrText: string,
    ctx: ComplianceExtractionContext,
  ): Promise<ComplianceExtractionResult> {
    const { apiKey, models } = this.config.gemini;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY hiányzik – a megfelelőség-kiolvasás nem fut.');
    }
    const prompt = this.buildPrompt(ocrText, ctx);
    let lastError: Error | undefined;
    for (const model of models) {
      try {
        return parseComplianceExtraction(await this.callModel(model, prompt, apiKey));
      } catch (err) {
        lastError = err as Error;
        const status = (err as { status?: number }).status;
        if (status && FALLBACK_STATUSES.has(status)) {
          this.logger.warn(`Gemini "${model}" limit/hiba (${status}) – következő.`);
          continue;
        }
        throw err;
      }
    }
    throw new Error(
      `Minden Gemini modell elérte a kvótát/hibát. Utolsó: ${lastError?.message ?? 'ismeretlen'}`,
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
        `Gemini hívás sikertelen (${model}): ${res.status} ${body.slice(0, 200)}`,
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

  private buildPrompt(ocrText: string, ctx: ComplianceExtractionContext): string {
    return [
      'Egy romániai jármű-megfelelőségi dokumentumot dolgozol fel:',
      'ITP (inspecția tehnică periodică / műszaki), RCA (kötelező biztosítás),',
      'vagy rovinietă (autópálya-matrica). A bemenet a dokumentum OCR szövege.',
      'Add vissza KIZÁRÓLAG egy JSON objektumot, magyarázat nélkül:',
      '{ "detectedType": "itp"|"rca"|"vignette"|null,',
      '  "validUntil": "YYYY-MM-DD"|null,   // az érvényesség VÉGE (valabil până la / expiră)',
      '  "confidence": 0..1,',
      '  "uncertainFields": [{ "path": string, "reason": string, "confidence": 0..1 }] }',
      ctx.expectedType ? `A várt típus: ${ctx.expectedType}.` : '',
      'Szabályok: csak a dokumentumban szereplő dátumot add vissza; ha több dátum van,',
      'az ÉRVÉNYESSÉG VÉGÉT válaszd (nem a kiállítás dátumát). Bizonytalanságnál null.',
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
