/**
 * Unit tesztek a `@valloreg/shared` zod extraction-kontraktusaira.
 *
 * Lefedett sémák:
 *  - extraction.ts:            VehicleCandidateSchema, ExtractedInvoiceSchema,
 *                              ExtractedItemSchema, UncertainFieldSchema,
 *                              ExtractionResultSchema
 *  - vehicle-extraction.ts:    VehicleRegistrationResultSchema
 *  - compliance-extraction.ts: ComplianceExtractionResultSchema
 *
 * Csak a megosztott csomagból (és zod-ból) importálunk – se Prisma, se NestJS.
 */
import {
  VehicleCandidateSchema,
  ExtractedInvoiceSchema,
  ExtractedItemSchema,
  UncertainFieldSchema,
  ExtractionResultSchema,
  VehicleRegistrationResultSchema,
  ComplianceExtractionResultSchema,
  ItemCategory,
  ItemType,
  PartType,
  DocumentType,
} from '@valloreg/shared';

describe('VehicleCandidateSchema', () => {
  it('minimális érvényes objektumot elfogad (minden mezőnek van defaultja)', () => {
    const result = VehicleCandidateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plate).toBeNull();
      expect(result.data.source).toBe('plate');
      expect(result.data.confidence).toBe(0);
    }
  });

  it('teljesen kitöltött érvényes objektumot elfogad', () => {
    const result = VehicleCandidateSchema.safeParse({
      plate: 'ABC-123',
      vin: 'WVWZZZ1JZXW000001',
      vehicleId: '11111111-1111-1111-1111-111111111111',
      source: 'vin',
      confidence: 0.75,
    });
    expect(result.success).toBe(true);
  });

  it('rossz típusú mezőt (plate: number) elutasít', () => {
    const result = VehicleCandidateSchema.safeParse({ plate: 123 });
    expect(result.success).toBe(false);
  });

  it('érvénytelen vehicleId UUID-t elutasít', () => {
    const result = VehicleCandidateSchema.safeParse({ vehicleId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('ismeretlen source enum értéket elutasít', () => {
    const result = VehicleCandidateSchema.safeParse({ source: 'satellite' });
    expect(result.success).toBe(false);
  });

  it('confidence > 1 esetén bukik (max(1))', () => {
    const result = VehicleCandidateSchema.safeParse({ confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it('confidence < 0 esetén bukik (min(0))', () => {
    const result = VehicleCandidateSchema.safeParse({ confidence: -0.1 });
    expect(result.success).toBe(false);
  });

  it('confidence határértékei (0 és 1) átmennek', () => {
    expect(VehicleCandidateSchema.safeParse({ confidence: 0 }).success).toBe(true);
    expect(VehicleCandidateSchema.safeParse({ confidence: 1 }).success).toBe(true);
  });
});

describe('ExtractedInvoiceSchema', () => {
  it('minimális érvényes objektumot elfogad (üres objektum, csak defaultok)', () => {
    const result = ExtractedInvoiceSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supplier).toBe('');
      expect(result.data.odometerKm).toBeNull();
      expect(result.data.vehicleCandidates).toEqual([]);
    }
  });

  it('teljesen kitöltött érvényes objektumot elfogad', () => {
    const result = ExtractedInvoiceSchema.safeParse({
      supplier: 'Auto Service Kft.',
      date: '2026-06-26',
      invoiceNumber: 'INV-2026-001',
      currency: 'HUF',
      odometerKm: 123456,
      netTotal: 1000,
      taxTotal: 270,
      grossTotal: 1270,
      vehicleCandidates: [{ plate: 'ABC-123', confidence: 0.9 }],
      confidence: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it('negatív odometerKm-t elutasít (nonnegative)', () => {
    const result = ExtractedInvoiceSchema.safeParse({ odometerKm: -5 });
    expect(result.success).toBe(false);
  });

  it('nem egész odometerKm-t elutasít (int)', () => {
    const result = ExtractedInvoiceSchema.safeParse({ odometerKm: 12.5 });
    expect(result.success).toBe(false);
  });

  it('rossz típusú supplier-t (number) elutasít', () => {
    const result = ExtractedInvoiceSchema.safeParse({ supplier: 42 });
    expect(result.success).toBe(false);
  });

  it('confidence tartományon kívül bukik', () => {
    expect(ExtractedInvoiceSchema.safeParse({ confidence: 2 }).success).toBe(false);
    expect(ExtractedInvoiceSchema.safeParse({ confidence: -1 }).success).toBe(false);
  });

  it('érvénytelen beágyazott vehicleCandidate elutasítja az egészet', () => {
    const result = ExtractedInvoiceSchema.safeParse({
      vehicleCandidates: [{ confidence: 5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('ExtractedItemSchema', () => {
  it('minimális érvényes objektumot elfogad (üres objektum, csak defaultok)', () => {
    const result = ExtractedItemSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe(ItemCategory.OTHER);
      expect(result.data.type).toBe(ItemType.GENERAL);
      expect(result.data.quantity).toBe(1);
      expect(result.data.price).toBe(0);
    }
  });

  it('teljesen kitöltött érvényes objektumot elfogad', () => {
    const result = ExtractedItemSchema.safeParse({
      name: 'Fékbetét csere',
      category: ItemCategory.PART,
      partType: PartType.BRAKES,
      type: ItemType.VEHICLE,
      vehicleId: '22222222-2222-2222-2222-222222222222',
      quantity: 2,
      unitPrice: 5000,
      price: 10000,
      confidence: 0.95,
    });
    expect(result.success).toBe(true);
  });

  it('ismeretlen category enum értéket elutasít', () => {
    const result = ExtractedItemSchema.safeParse({ category: 'rocket-fuel' });
    expect(result.success).toBe(false);
  });

  it('érvénytelen vehicleId UUID-t elutasít', () => {
    const result = ExtractedItemSchema.safeParse({ vehicleId: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rossz típusú price-t (string) elutasít', () => {
    const result = ExtractedItemSchema.safeParse({ price: 'sok' });
    expect(result.success).toBe(false);
  });

  it('confidence tartományon kívül bukik', () => {
    expect(ExtractedItemSchema.safeParse({ confidence: 1.0001 }).success).toBe(false);
    expect(ExtractedItemSchema.safeParse({ confidence: -0.0001 }).success).toBe(false);
  });
});

describe('UncertainFieldSchema', () => {
  it('minimális érvényes objektumot elfogad (csak a kötelező path)', () => {
    const result = UncertainFieldSchema.safeParse({ path: 'invoice.date' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe('');
      expect(result.data.confidence).toBe(0);
    }
  });

  it('hiányzó kötelező path mezőt elutasít', () => {
    const result = UncertainFieldSchema.safeParse({ reason: 'homályos' });
    expect(result.success).toBe(false);
  });

  it('rossz típusú path-t (number) elutasít', () => {
    const result = UncertainFieldSchema.safeParse({ path: 7 });
    expect(result.success).toBe(false);
  });

  it('confidence tartományon kívül bukik', () => {
    const result = UncertainFieldSchema.safeParse({ path: 'x', confidence: 3 });
    expect(result.success).toBe(false);
  });
});

describe('ExtractionResultSchema', () => {
  it('minimális érvényes objektumot elfogad (csak a kötelező invoice)', () => {
    const result = ExtractionResultSchema.safeParse({ invoice: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentType).toBe(DocumentType.INVOICE);
      expect(result.data.items).toEqual([]);
      expect(result.data.uncertainFields).toEqual([]);
    }
  });

  it('hiányzó kötelező invoice mezőt elutasít', () => {
    const result = ExtractionResultSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it('teljesen kitöltött érvényes objektumot elfogad', () => {
    const result = ExtractionResultSchema.safeParse({
      documentType: DocumentType.INVOICE,
      invoice: {
        supplier: 'Szerviz Kft.',
        currency: 'RON',
        confidence: 0.7,
      },
      items: [
        { name: 'Olajcsere', category: ItemCategory.SERVICE, price: 200 },
      ],
      uncertainFields: [{ path: 'invoice.date', reason: 'olvashatatlan', confidence: 0.2 }],
    });
    expect(result.success).toBe(true);
  });

  it('ismeretlen documentType enum értéket elutasít', () => {
    const result = ExtractionResultSchema.safeParse({
      documentType: 'spaceship',
      invoice: {},
    });
    expect(result.success).toBe(false);
  });

  it('uncertainFields: üres tömb átmegy', () => {
    const result = ExtractionResultSchema.safeParse({ invoice: {}, uncertainFields: [] });
    expect(result.success).toBe(true);
  });

  it('uncertainFields: kitöltött tömb átmegy', () => {
    const result = ExtractionResultSchema.safeParse({
      invoice: {},
      uncertainFields: [
        { path: 'items[0].price' },
        { path: 'invoice.currency', reason: 'hiányzik', confidence: 0.4 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('érvénytelen uncertainFields elem (hiányzó path) elutasítja az egészet', () => {
    const result = ExtractionResultSchema.safeParse({
      invoice: {},
      uncertainFields: [{ reason: 'nincs path' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('VehicleRegistrationResultSchema', () => {
  it('minimális érvényes objektumot elfogad (üres objektum, csak defaultok)', () => {
    const result = VehicleRegistrationResultSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plate).toBeNull();
      expect(result.data.confidence).toBe(0);
      expect(result.data.uncertainFields).toEqual([]);
    }
  });

  it('teljesen kitöltött érvényes objektumot elfogad', () => {
    const result = VehicleRegistrationResultSchema.safeParse({
      plate: 'B-123-XYZ',
      vin: 'WVWZZZ1JZXW000002',
      make: 'Volkswagen',
      model: 'Passat',
      year: 2018,
      firstRegistration: '2018-03-15',
      fuelType: 'diesel',
      engineCm3: 1968,
      powerKw: 110,
      color: 'fekete',
      category: 'M1',
      ownerName: 'Teszt Elek',
      confidence: 0.88,
      uncertainFields: [{ path: 'vin', confidence: 0.5 }],
    });
    expect(result.success).toBe(true);
  });

  it('nem egész year-t elutasít (int)', () => {
    const result = VehicleRegistrationResultSchema.safeParse({ year: 2018.5 });
    expect(result.success).toBe(false);
  });

  it('rossz típusú make-et (number) elutasít', () => {
    const result = VehicleRegistrationResultSchema.safeParse({ make: 123 });
    expect(result.success).toBe(false);
  });

  it('confidence tartományon kívül bukik', () => {
    expect(VehicleRegistrationResultSchema.safeParse({ confidence: 1.2 }).success).toBe(false);
    expect(VehicleRegistrationResultSchema.safeParse({ confidence: -0.5 }).success).toBe(false);
  });

  it('uncertainFields: üres és kitöltött eset is átmegy', () => {
    expect(
      VehicleRegistrationResultSchema.safeParse({ uncertainFields: [] }).success,
    ).toBe(true);
    expect(
      VehicleRegistrationResultSchema.safeParse({
        uncertainFields: [{ path: 'plate', reason: 'koszos', confidence: 0.3 }],
      }).success,
    ).toBe(true);
  });
});

describe('ComplianceExtractionResultSchema', () => {
  it('minimális érvényes objektumot elfogad (üres objektum, csak defaultok)', () => {
    const result = ComplianceExtractionResultSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.detectedType).toBeNull();
      expect(result.data.validUntil).toBeNull();
      expect(result.data.confidence).toBe(0);
      expect(result.data.uncertainFields).toEqual([]);
    }
  });

  it('teljesen kitöltött érvényes objektumot elfogad', () => {
    const result = ComplianceExtractionResultSchema.safeParse({
      detectedType: 'itp',
      validUntil: '2027-01-01',
      confidence: 0.91,
      uncertainFields: [{ path: 'validUntil', confidence: 0.6 }],
    });
    expect(result.success).toBe(true);
  });

  it('ismeretlen detectedType enum értéket elutasít', () => {
    const result = ComplianceExtractionResultSchema.safeParse({ detectedType: 'casco' });
    expect(result.success).toBe(false);
  });

  it('rossz típusú validUntil-t (number) elutasít', () => {
    const result = ComplianceExtractionResultSchema.safeParse({ validUntil: 20270101 });
    expect(result.success).toBe(false);
  });

  it('confidence tartományon kívül bukik', () => {
    expect(ComplianceExtractionResultSchema.safeParse({ confidence: 1.01 }).success).toBe(false);
    expect(ComplianceExtractionResultSchema.safeParse({ confidence: -0.01 }).success).toBe(false);
  });

  it('uncertainFields: üres és kitöltött eset is átmegy', () => {
    expect(ComplianceExtractionResultSchema.safeParse({ uncertainFields: [] }).success).toBe(true);
    expect(
      ComplianceExtractionResultSchema.safeParse({
        uncertainFields: [{ path: 'detectedType', reason: 'kétséges' }],
      }).success,
    ).toBe(true);
  });
});
