import { Injectable } from '@nestjs/common';
import type {
  OcrInput,
  OcrProvider,
  OcrResult,
} from '../ocr.provider';

/**
 * Determinisztikus stub OCR. Nem hív külső szolgáltatást – egy hihető magyar
 * szervizszámla-szöveget ad vissza, hogy a teljes pipeline futtatható/tesztelhető
 * legyen Fázis 1-ben.
 */
@Injectable()
export class StubOcrProvider implements OcrProvider {
  recognize(input: OcrInput): Promise<OcrResult> {
    const text = [
      'AUTÓSZERVIZ KFT.',
      'Adószám: 12345678-2-42',
      `Számla sorszám: SZ-2026-000${this.deterministicSuffix(input.documentId)}`,
      'Kelt: 2026-06-15',
      'Pénznem: RON',
      'Rendszám: ABC-123',
      'Km óra állás: 152340',
      '',
      'Tételek:',
      '1. Fékbetét csere (első) - 2 db - 18.000 RON',
      '2. Olajcsere 5W30 motorolaj - 4 liter - 12.000 RON',
      '3. Olajszűrő - 1 db - 3.500 RON',
      '4. Munkadíj - 15.000 RON',
      '',
      'Nettó összesen: 48.500 RON',
      'ÁFA (27%): 13.095 RON',
      'Bruttó összesen: 61.595 RON',
    ].join('\n');

    return Promise.resolve({ text, pages: 1 });
  }

  private deterministicSuffix(documentId: string): string {
    // Az UUID utolsó karakteréből számjegy, hogy stabil de "egyedi" legyen.
    const last = documentId.replace(/[^0-9]/g, '').slice(-1);
    return last || '1';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TODO (Fázis 2): MistralOcrProvider – Mistral OCR API hívás.
//   recognize(): tölts le presigned GET-tel, küldd a Mistral OCR endpointra,
//   térj vissza { text, pages }-szel. MISTRAL_API_KEY env-ből.
//
// TODO (Fázis 2): GoogleDocumentAiOcrProvider – Google Document AI.
//   GOOGLE_DOCUMENT_AI_PROJECT_ID / LOCATION / PROCESSOR_ID env-ből.
// ───────────────────────────────────────────────────────────────────────────
