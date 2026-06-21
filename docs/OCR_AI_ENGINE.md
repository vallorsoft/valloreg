# OCR + AI motor – a platform „core intelligence layer"-e

A motor feladata: szervizszámlából (PDF/JPG/PNG) **automatikusan** strukturált, validált,
tanuló adatmodellt készíteni, minimális emberi beavatkozással. Kimenete a
`@valloreg/shared` **`ExtractionResult`** szerződése (zod-validált).

> Implementáció: Fázis 2. Fázis 1-ben a **portok (interfészek), a queue és a státuszok**
> készülnek el, stub providerrel, hogy a teljes pipeline futtatható és tesztelhető legyen.

## Rétegek

### 1. OCR réteg
- Pluggable provider: `stub` (dev), `mistral` (Mistral OCR), `google` (Document AI).
- HU / RO / EN dokumentumok; szkennelt **és** digitális PDF; szöveg + layout kinyerés.
- Interfész: `OcrProvider.recognize(file) -> { text, blocks, pages }`.

### 2. Extraction réteg (AI)
- OCR szövegből strukturált JSON. Provider: `stub` (dev), `anthropic` (Claude) alapból.
- Kinyert mezők: beszállító, dátum, számlaszám, pénznem, km-állás, tételek
  (alkatrész/munkadíj/szolgáltatás), árak és adók, rendszám/VIN jelöltek, confidence.
- Hiányos/hibás adat → `uncertainFields[]` (path + ok + confidence).
- Interfész: `ExtractionProvider.extract(ocr, context) -> ExtractionResult`.

### 3. Intelligens kategorizálás
- Minden tétel besorolása: `vehicle` / `tool` / `general` (ItemType), részletes
  `ItemCategory`, és alkatrész-típus (`PartType`: fék, motor, szűrő…).

### 4. Jármű matching engine
- Jelöltek: rendszám, VIN, beszállítói minta, korábbi adatok.
- Bizonytalanságnál a felhasználótól kér megerősítést (review).
- Egy számla több járműre bontható (tételszintű hozzárendelés).

### 5. Human-in-the-loop validáció
- Feldolgozás után review állapot; a UI jármű-választást/módosítást, új jármű
  felvételét és tételenkénti szétosztást enged.
- A felhasználói visszajelzés rögzítve → tanulás.

### 6. Tanuló rendszer
- Tárolt döntések: `supplier → jármű` és `tétel → kategória` mapping.
- Új, ugyanattól a beszállítótól érkező számlánál javaslat; pontosság javul.

### 7. Output formátum
Kizárólag a `ExtractionResult` séma (lásd `packages/shared/src/extraction.ts`):

```jsonc
{
  "invoice": {
    "supplier": "", "date": "", "invoiceNumber": "", "currency": "",
    "odometerKm": null, "vehicleCandidates": [], "confidence": 0.0
  },
  "items": [
    { "name": "", "category": "part", "type": "vehicle", "vehicleId": null, "price": 0, "confidence": 0.0 }
  ],
  "uncertainFields": []
}
```

### 8. Technikai elvárások
- **Aszinkron**, queue-alapú (BullMQ + Redis); horizontálisan skálázható workerek.
- **Idempotencia**: dokumentum-hash alapú job-kulcs; ugyanaz a fájl nem dolgozódik fel kétszer.
- **Retry + dead-letter**: átmeneti hiba újrapróbál, tartós hiba DLQ-ba kerül.
- **Audit**: minden OCR/AI döntés naplózva; nyers OCR és prompt/response megőrizve (tenant-izoláltan).
- **Multi-tenant**: `tenantId` minden rekordon és jobon.

### 9. Cél
A felhasználó csak feltölt; a rendszer értelmez, kategorizál, járműhöz rendel, és
csak minimális ellenőrzést kér. Ez határozza meg a termék versenyképességét.

## Provider konfiguráció (.env)

```
OCR_PROVIDER=stub|mistral|google
EXTRACTION_PROVIDER=stub|anthropic
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Új provider hozzáadása = az interfész implementálása + regisztráció a factory-ban;
a pipeline többi része változatlan.
