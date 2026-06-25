import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { StorageService } from '../../storage/storage.service';
import type { OcrInput, OcrProvider, OcrResult } from '../ocr.provider';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const FALLBACK_STATUSES = new Set([429, 500, 503]);

const OCR_PROMPT =
  'Extract all text from this document. Return the complete text content exactly ' +
  'as it appears, maintaining structure with line breaks. Include all numbers, dates, ' +
  'company names, and item descriptions. Do not summarize or omit any content.';

/**
 * Gemini Vision OCR provider. A fájlt S3-ból tölti le, base64-be konvertálja,
 * majd a Gemini vision API-val kinyeri a szöveget.
 *
 * Modell-lánc: a config.gemini.models sorrendben próbál; 429/5xx esetén a
 * következő modellre vált (mindegyiknek külön napi ingyenes kerete van).
 */
@Injectable()
export class GeminiOcrProvider implements OcrProvider {
  private readonly logger = new Logger(GeminiOcrProvider.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly storage: StorageService,
  ) {}

  async recognize(input: OcrInput): Promise<OcrResult> {
    const { apiKey, models } = this.config.gemini;
    const fileBytes = await this.storage.download(input.storageKey);
    const base64Data = fileBytes.toString('base64');

    let lastError: Error | undefined;
    for (const model of models) {
      try {
        const text = await this.callModel(model, apiKey, base64Data, input.mimeType);
        const pages = this.estimatePages(text);
        this.logger.debug(
          `Gemini OCR kész (model: ${model}, pages: ${pages}, chars: ${text.length})`,
        );
        return { text, pages };
      } catch (err) {
        lastError = err as Error;
        const status = (err as { status?: number }).status;
        if (status !== undefined && FALLBACK_STATUSES.has(status)) {
          this.logger.warn(`Gemini OCR ${status} (model: ${model}) – következő modell.`);
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `Gemini OCR: minden modell elérte a kvótát/hibát. Utolsó hiba: ${lastError?.message ?? 'ismeretlen'}`,
    );
  }

  private async callModel(
    model: string,
    apiKey: string,
    base64Data: string,
    mimeType: string,
  ): Promise<string> {
    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Data } },
            { text: OCR_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = new Error(
        `Gemini OCR hívás sikertelen (${model}): ${res.status} ${body.slice(0, 200)}`,
      ) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) throw new Error(`Gemini OCR: üres válasz (${model}).`);
    return text;
  }

  /** Oldalbecslés: \f (form feed) karakterek + 1. */
  private estimatePages(text: string): number {
    return (text.match(/\f/g)?.length ?? 0) + 1;
  }
}
