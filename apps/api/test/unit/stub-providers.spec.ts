/**
 * Unit tesztek a STUB providerekre – a dev / kulcs-nélküli fallback útvonal
 * garanciája. Minden stub determinisztikus kimenetét a megfelelő
 * `@valloreg/shared` zod kontraktussal (vagy alak-invariánssal) validáljuk, és
 * ellenőrizzük a determinizmust (ugyanaz a bemenet → ugyanaz a kimenet).
 *
 * Lefedett stubok:
 *  - StubExtractionProvider            → ExtractionResultSchema
 *  - StubVehicleExtractionProvider     → VehicleRegistrationResultSchema
 *  - StubComplianceExtractionProvider  → ComplianceExtractionResultSchema
 *  - StubVerificationProvider          → alak-invariáns (nincs zod séma)
 *  - StubOcrProvider                   → alak-invariáns (nyers szöveg)
 *  - StubRecallProvider                → alak-invariáns (VehicleRecall interfész)
 *
 * Egyik provider sem húz be Prisma-t: kizárólag @valloreg/shared-ből,
 * NestJS-ből és a saját (típus-only) port-interfészeikből importálnak. Ezért
 * egy stubot sem kellett kihagyni. A teszt szándékosan NEM importál semmit,
 * ami (tranzitívan) behúzná a @prisma/client-et.
 */
import {
  ExtractionResultSchema,
  VehicleRegistrationResultSchema,
  ComplianceExtractionResultSchema,
} from '@valloreg/shared';

import { StubExtractionProvider } from '../../src/extraction/providers/stub-extraction.provider';
import { StubVehicleExtractionProvider } from '../../src/extraction/providers/stub-vehicle-extraction.provider';
import { StubComplianceExtractionProvider } from '../../src/extraction/providers/stub-compliance-extraction.provider';
import { StubVerificationProvider } from '../../src/verification/providers/stub-verification.provider';
import { StubOcrProvider } from '../../src/ocr/providers/stub-ocr.provider';
import { StubRecallProvider } from '../../src/benchmark/providers/stub-recall.provider';

describe('StubExtractionProvider', () => {
  const provider = new StubExtractionProvider();
  const ctx = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    documentId: '22222222-2222-2222-2222-222222222222',
  };

  it('érvényes ExtractionResult-ot ad vissza (zod kontraktus)', async () => {
    const result = await provider.extract('bármilyen OCR szöveg', ctx);
    expect(ExtractionResultSchema.safeParse(result).success).toBe(true);
  });

  it('determinisztikus: ugyanaz a bemenet → azonos kimenet', async () => {
    const a = await provider.extract('ugyanaz', ctx);
    const b = await provider.extract('ugyanaz', ctx);
    expect(a).toEqual(b);
  });

  it('plauzibilis tételeket tartalmaz (confidence >= 0.8 happy path)', async () => {
    const result = await provider.extract('x', ctx);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.invoice.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

describe('StubVehicleExtractionProvider', () => {
  const provider = new StubVehicleExtractionProvider();
  const ctx = { tenantId: '11111111-1111-1111-1111-111111111111' };

  it('érvényes VehicleRegistrationResult-ot ad vissza (zod kontraktus)', async () => {
    const result = await provider.extractVehicle('forgalmi szöveg', ctx);
    expect(VehicleRegistrationResultSchema.safeParse(result).success).toBe(true);
  });

  it('determinisztikus: ugyanaz a bemenet → azonos kimenet', async () => {
    const a = await provider.extractVehicle('x', ctx);
    const b = await provider.extractVehicle('x', ctx);
    expect(a).toEqual(b);
  });
});

describe('StubComplianceExtractionProvider', () => {
  const provider = new StubComplianceExtractionProvider();

  it('érvényes ComplianceExtractionResult-ot ad vissza (zod kontraktus)', async () => {
    const result = await provider.extractCompliance('itp szöveg', {
      tenantId: '11111111-1111-1111-1111-111111111111',
      expectedType: 'itp',
    });
    expect(ComplianceExtractionResultSchema.safeParse(result).success).toBe(true);
    expect(result.detectedType).toBe('itp');
  });

  it('expectedType nélkül is érvényes (detectedType null)', async () => {
    const result = await provider.extractCompliance('szöveg', {
      tenantId: '11111111-1111-1111-1111-111111111111',
    });
    expect(ComplianceExtractionResultSchema.safeParse(result).success).toBe(true);
    expect(result.detectedType).toBeNull();
  });

  it('determinisztikus: ugyanaz a bemenet → azonos kimenet', async () => {
    const ctx = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      expectedType: 'rca' as const,
    };
    const a = await provider.extractCompliance('x', ctx);
    const b = await provider.extractCompliance('x', ctx);
    expect(a).toEqual(b);
  });
});

describe('StubVerificationProvider', () => {
  const provider = new StubVerificationProvider();
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  it('rendszámmal: "ok" + valid ISO dátumok (alak-invariáns)', async () => {
    const result = await provider.verify({
      plate: 'ABC-123',
      vin: null,
      country: 'RO',
    });
    expect(result.status).toBe('ok');
    expect(result.source).toBe('stub');
    expect(result.itpValidUntil).toMatch(ISO_DATE);
    expect(result.rcaValidUntil).toMatch(ISO_DATE);
    expect(result.vignetteValidUntil).toMatch(ISO_DATE);
  });

  it('azonosító nélkül: "not_found" + null dátumok', async () => {
    const result = await provider.verify({ plate: null, vin: null, country: 'RO' });
    expect(result.status).toBe('not_found');
    expect(result.itpValidUntil).toBeNull();
    expect(result.rcaValidUntil).toBeNull();
    expect(result.vignetteValidUntil).toBeNull();
  });

  it('determinisztikus: ugyanaz a bemenet → azonos kimenet (status/source stabil)', async () => {
    const input = { plate: 'ABC-123', vin: null, country: 'RO' };
    const a = await provider.verify(input);
    const b = await provider.verify(input);
    expect(a.status).toBe(b.status);
    expect(a.source).toBe(b.source);
  });
});

describe('StubOcrProvider', () => {
  const provider = new StubOcrProvider();
  const input = {
    storageKey: 'tenant/doc.pdf',
    mimeType: 'application/pdf',
    tenantId: '11111111-1111-1111-1111-111111111111',
    documentId: '22222222-2222-2222-2222-222222222222',
  };

  it('nem üres szöveget és pages >= 1 értéket ad (alak-invariáns)', async () => {
    const result = await provider.recognize(input);
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.pages).toBeGreaterThanOrEqual(1);
  });

  it('determinisztikus: ugyanaz a documentId → azonos kimenet', async () => {
    const a = await provider.recognize(input);
    const b = await provider.recognize(input);
    expect(a).toEqual(b);
  });
});

describe('StubRecallProvider', () => {
  const provider = new StubRecallProvider();

  it('ismert márka/modellre érvényes VehicleRecall alakot ad (alak-invariáns)', async () => {
    const recalls = await provider.getRecalls({
      make: 'Volkswagen',
      model: 'Golf',
      year: 2015,
    });
    expect(recalls.length).toBeGreaterThan(0);
    for (const r of recalls) {
      expect(typeof r.reference).toBe('string');
      expect(r.reference.length).toBeGreaterThan(0);
      expect(typeof r.makeModel).toBe('string');
      expect(typeof r.hazard).toBe('string');
      expect(r.source).toBe('curated');
    }
  });

  it('üres lekérdezésre (nincs make/model) üres listát ad', async () => {
    const recalls = await provider.getRecalls({ make: null, model: null, year: null });
    expect(recalls).toEqual([]);
  });

  it('determinisztikus: ugyanaz a bemenet → azonos kimenet', async () => {
    const query = { make: 'ford', model: 'transit', year: 2016 };
    const a = await provider.getRecalls(query);
    const b = await provider.getRecalls(query);
    expect(a).toEqual(b);
  });
});
