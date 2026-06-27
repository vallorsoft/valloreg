import * as ExcelJS from 'exceljs';
import {
  SpreadsheetParserService,
  guessPartType,
  isLaborItem,
  isIncomeSheet,
  looksLikePlate,
  normalizeHeader,
  parseDateIso,
  parseItemLine,
  parseItemsCell,
  parseNumber,
  parsePaid,
} from './spreadsheet-parser.service';

describe('spreadsheet-parser tiszta segédfüggvények', () => {
  it('normalizeHeader: ékezet/kisbetű/jel le', () => {
    expect(normalizeHeader('Dátum')).toBe('datum');
    expect(normalizeHeader('  Piese ')).toBe('piese');
    expect(normalizeHeader('Számla szám')).toBe('szamlaszam');
  });

  it('isIncomeSheet: bevétel-fülek felismerése', () => {
    expect(isIncomeSheet('Bevetelek 2025')).toBe(true);
    expect(isIncomeSheet('Venituri')).toBe(true);
    expect(isIncomeSheet('B104VLR')).toBe(false);
  });

  it('looksLikePlate: csak rendszám-szerű fülnevek', () => {
    expect(looksLikePlate('B104VLR')).toBe(true);
    expect(looksLikePlate('Remorka')).toBe(false); // nincs számjegy
    expect(looksLikePlate('EGYEBB KOLTSEG')).toBe(false);
    expect(looksLikePlate('Munkalap1')).toBe(false);
  });

  it('parseNumber: RON / ezres / tizedes alakok', () => {
    expect(parseNumber('2008.59')).toBeCloseTo(2008.59);
    expect(parseNumber('35 539.35 RON')).toBeCloseTo(35539.35);
    expect(parseNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(parseNumber('')).toBeNull();
  });

  it('parseDateIso: több formátum', () => {
    expect(parseDateIso('2026-01-10')).toBe('2026-01-10');
    expect(parseDateIso('10.01.2026')).toBe('2026-01-10');
    expect(parseDateIso('valami')).toBe('');
  });

  it('parsePaid: IGEN/NEM/DA/NU', () => {
    expect(parsePaid('IGEN')).toBe(true);
    expect(parsePaid('NEM')).toBe(false);
    expect(parsePaid('DA')).toBe(true);
    expect(parsePaid('')).toBeNull();
  });

  it('guessPartType: kulcsszó-heurisztika', () => {
    expect(guessPartType('Set placute frana')).toBe('brakes');
    expect(guessPartType('Filtru de combustibil')).toBe('filters');
    expect(guessPartType('Lichid racire concentrat')).toBe('fluids');
    expect(guessPartType('valami ismeretlen')).toBeNull();
  });

  it('isLaborItem: munkadíj (manopera) felismerése', () => {
    expect(isLaborItem('MANOPERA (INLOCUIRE, REMEDIERE)')).toBe(true);
    expect(isLaborItem('Diagnoza webasto')).toBe(true);
    expect(isLaborItem('Reparatie sistem')).toBe(true);
    expect(isLaborItem('Munkadíj csere')).toBe(true);
    expect(isLaborItem('Separator de ulei')).toBe(false);
    expect(isLaborItem('Filtru hidraulic')).toBe(false);
  });
});

describe('parseItemLine: cikkszám + név + mennyiség bontása', () => {
  it('numerikus vezető kód a névhez tapadva', () => {
    const item = parseItemLine('0600969Separator de ulei B 1');
    expect(item).not.toBeNull();
    expect(item!.articleNumber).toBe('0600969');
    expect(item!.name).toBe('Separator de ulei');
    expect(item!.quantity).toBe(1);
    expect(item!.unit).toBe('B');
  });

  it('szóközös numerikus kód + BUC mennyiség', () => {
    const item = parseItemLine('470 018 00 80Etansare corp filtru ulei BUC 1');
    expect(item!.articleNumber).toBe('470 018 00 80');
    expect(item!.name).toContain('Etansare corp filtru ulei');
    expect(item!.unit?.toLowerCase()).toBe('buc');
    expect(item!.quantity).toBe(1);
  });

  it('betű+szám kód (EL444980)', () => {
    const item = parseItemLine('EL444980Gernitura ventilare motor BUC 1');
    expect(item!.articleNumber).toBe('EL444980');
    expect(item!.name).toContain('Gernitura ventilare motor');
  });

  it('kód nélküli, csupa nagybetűs név', () => {
    const item = parseItemLine('SET PLACUTE FATA+SPATE');
    expect(item!.articleNumber).toBeNull();
    expect(item!.name).toBe('SET PLACUTE FATA+SPATE');
    expect(item!.quantity).toBe(1);
  });

  it('üres sor → null', () => {
    expect(parseItemLine('   ')).toBeNull();
  });
});

describe('parseItemsCell: több tétel egy cellából', () => {
  it('soronként egy tétel', () => {
    const cell =
      '0600969Separator de ulei B 1\n' +
      '470 018 00 80Etansare corp filtru ulei BUC 1\n' +
      'LE26505.84Element injector CR BUC 2';
    const items = parseItemsCell(cell);
    expect(items).toHaveLength(3);
    expect(items[2]!.quantity).toBe(2);
  });
});

describe('SpreadsheetParserService.parse (teljes munkafüzet)', () => {
  async function buildWorkbook(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();

    // Költség-munkalap: a fül neve rendszám.
    const ws = wb.addWorksheet('B104VLR');
    ws.addRow(['Data', 'Factura', 'Piese', 'Firma', 9788.5, 'KM', 'Fizetve']);
    ws.addRow([
      new Date('2026-01-10'),
      'RO6026000289',
      '0600969Separator de ulei B 1\n470 018 00 80Etansare corp filtru ulei BUC 1',
      'S.C. INTER CARS ROMANIA S.R.L.',
      2008.59,
      516678,
      'IGEN',
    ]);

    // Bevétel-munkalap: kihagyandó.
    const inc = wb.addWorksheet('Bevetelek 2025');
    inc.addRow(['Datum', 'Számla', 'Cég', 'Ár', 'Teljesitve']);
    inc.addRow([new Date('2025-05-06'), 'AVANS', 'VESNA GC', '35 539.35 RON', 'IGEN']);

    // Üres munkalap.
    wb.addWorksheet('Munkalap1');

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }

  it('felismeri a költség-sort, kihagyja a bevétel/üres füleket', async () => {
    const parser = new SpreadsheetParserService();
    const buffer = await buildWorkbook();
    const result = await parser.parse(buffer);

    // Egy költség-sor (a B104VLR fülről).
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0]!;
    expect(row.sheet).toBe('B104VLR');
    expect(row.invoiceNumber).toBe('RO6026000289');
    expect(row.supplier).toBe('S.C. INTER CARS ROMANIA S.R.L.');
    expect(row.grossTotal).toBeCloseTo(2008.59);
    expect(row.odometerKm).toBe(516678);
    expect(row.paid).toBe(true);
    expect(row.date).toBe('2026-01-10');
    expect(row.vehiclePlate).toBe('B104VLR');
    expect(row.items.length).toBeGreaterThanOrEqual(2);

    // A bevétel-fül kihagyva (income), az üres fül is.
    const income = result.sheets.find((s) => s.name === 'Bevetelek 2025');
    expect(income?.skipped).toBe(true);
    expect(income?.skipReason).toBe('income');
    const empty = result.sheets.find((s) => s.name === 'Munkalap1');
    expect(empty?.skipped).toBe(true);
  });
});
