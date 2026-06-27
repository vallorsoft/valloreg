import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SpreadsheetRowAction, SpreadsheetWarningCode } from '@valloreg/shared';
import type {
  SpreadsheetImportItem,
  SpreadsheetImportRow,
  SpreadsheetSheetSummary,
} from '@valloreg/shared';
import { AppException } from '../../common/exceptions/app.exception';

/** A parser nyers kimenete (még DB-jármű-illesztés és duplikátum-jelölés nélkül). */
export interface ParsedWorkbook {
  sheets: SpreadsheetSheetSummary[];
  rows: SpreadsheetImportRow[];
  /**
   * Soronkénti NYERS "Piese" cellaszöveg (kulcs: `${sheet}#${rowNumber}`). Csak
   * belső használatra (az AI-fallbackhez); a preview API-válaszban nem szerepel.
   */
  rawItems: Map<string, string>;
}

/** Kulcs a nyers-cella térképhez. */
export function rowKey(sheet: string, rowNumber: number): string {
  return `${sheet}#${rowNumber}`;
}

/** Legfeljebb ennyi adatsort dolgozunk fel munkalaponként (visszaélés ellen). */
const MAX_ROWS_PER_SHEET = 2000;
/** A fejléc keresése az első ennyi sorban. */
const HEADER_SCAN_ROWS = 12;
/** Ismert mértékegységek a tétel-sor végéről. */
const KNOWN_UNITS = new Set([
  'buc',
  'bucati',
  'bucăți',
  'db',
  'set',
  'l',
  'kg',
  'm',
  'b',
  'ml',
  'pár',
  'par',
]);

/** Oszlop-aliasok (ékezet/kisbetű normalizálva). */
const COLUMN_ALIASES: Record<keyof ColumnMap, string[]> = {
  date: ['data', 'datum', 'date', 'data', 'kelt'],
  invoiceNumber: ['factura', 'fatura', 'szamla', 'invoice', 'nrfactura', 'szamlaszam', 'nr'],
  items: [
    'piese',
    'tetel',
    'tetelek',
    'items',
    'alkatresz',
    'alkatreszek',
    'produse',
    'articole',
    'munka',
  ],
  supplier: ['firma', 'ceg', 'beszallito', 'furnizor', 'supplier', 'szallito', 'partner'],
  total: ['suma', 'osszeg', 'ar', 'total', 'pret', 'ertek', 'value', 'brutto', 'vegosszeg'],
  odometer: ['km', 'kilometer', 'odometer', 'oraallas'],
  paid: ['fizetve', 'platit', 'paid', 'kifizetve', 'achitat', 'teljesitve'],
};

/** A felismert oszlop-indexek (1-alapú, exceljs konvenció). */
interface ColumnMap {
  date?: number;
  invoiceNumber?: number;
  items?: number;
  supplier?: number;
  total?: number;
  odometer?: number;
  paid?: number;
}

/**
 * Excel (XLSX/XLS) köteges-import PARSER. Tisztán a fájlból dolgozik (nincs DB):
 * munkalaponként felismeri a fejlécet, az oszlopokat, és soronként számla-előnézeti
 * sorokat épít. A "Piese" cella mindig TÉTEL-LISTAként parse-olódik (1..N tétel).
 *
 * A jármű DB-illesztést és a duplikátum-jelölést a SpreadsheetImportService végzi
 * (annak van tenant-scope-olt DB-hozzáférése).
 */
@Injectable()
export class SpreadsheetParserService {
  async parse(buffer: Buffer): Promise<ParsedWorkbook> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch (err) {
      throw AppException.spreadsheetParseFailed(
        `A táblázat nem olvasható: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const sheets: SpreadsheetSheetSummary[] = [];
    const rows: SpreadsheetImportRow[] = [];
    const rawItems = new Map<string, string>();

    for (const ws of wb.worksheets) {
      const sheetName = (ws.name ?? '').trim();
      const plate = looksLikePlate(sheetName) ? normalizePlateRaw(sheetName) : null;

      // Bevétel-munkalap: most kihagyjuk (nincs bevétel-domain).
      if (isIncomeSheet(sheetName)) {
        sheets.push({
          name: sheetName,
          vehiclePlate: plate,
          matchedVehicleId: null,
          rowCount: 0,
          skipped: true,
          skipReason: 'income',
        });
        continue;
      }

      const header = findHeader(ws);
      if (!header) {
        sheets.push({
          name: sheetName,
          vehiclePlate: plate,
          matchedVehicleId: null,
          rowCount: 0,
          skipped: true,
          skipReason: 'no_columns',
        });
        continue;
      }

      const sheetRows = this.extractRows(ws, header, sheetName, plate, rawItems);
      if (sheetRows.length === 0) {
        sheets.push({
          name: sheetName,
          vehiclePlate: plate,
          matchedVehicleId: null,
          rowCount: 0,
          skipped: true,
          skipReason: 'empty',
        });
        continue;
      }

      sheets.push({
        name: sheetName,
        vehiclePlate: plate,
        matchedVehicleId: null,
        rowCount: sheetRows.length,
        skipped: false,
      });
      rows.push(...sheetRows);
    }

    return { sheets, rows, rawItems };
  }

  /** Egy munkalap adatsorainak kinyerése a felismert fejléc alapján. */
  private extractRows(
    ws: ExcelJS.Worksheet,
    header: { rowIndex: number; columns: ColumnMap },
    sheetName: string,
    plate: string | null,
    rawItems: Map<string, string>,
  ): SpreadsheetImportRow[] {
    const { rowIndex, columns } = header;
    const result: SpreadsheetImportRow[] = [];
    const lastRow = Math.min(ws.rowCount, rowIndex + MAX_ROWS_PER_SHEET);

    for (let r = rowIndex + 1; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const date = columns.date ? cellDateIso(row.getCell(columns.date)) : '';
      const invoiceRaw = columns.invoiceNumber ? cellText(row.getCell(columns.invoiceNumber)) : '';
      const supplierRaw = columns.supplier ? cellText(row.getCell(columns.supplier)) : '';
      const itemsRaw = columns.items ? cellText(row.getCell(columns.items)) : '';
      const total = columns.total ? cellNumber(row.getCell(columns.total)) : null;
      const odometer = columns.odometer ? cellInt(row.getCell(columns.odometer)) : null;
      const paid = columns.paid ? parsePaid(cellText(row.getCell(columns.paid))) : null;

      // Teljesen üres sor: nem emeljük be.
      if (
        !date &&
        !invoiceRaw &&
        !supplierRaw &&
        !itemsRaw &&
        total === null &&
        odometer === null
      ) {
        continue;
      }

      const warnings: SpreadsheetWarningCode[] = [];

      const invoiceLines = splitLines(invoiceRaw);
      const invoiceNumber = invoiceLines[0] ?? '';
      if (invoiceLines.length > 1) {
        warnings.push(SpreadsheetWarningCode.MULTIPLE_INVOICE_NUMBERS);
      }

      const supplierLines = splitLines(supplierRaw);
      const supplier = supplierLines[0] ?? '';
      if (supplierLines.length > 1) {
        warnings.push(SpreadsheetWarningCode.MULTIPLE_SUPPLIERS);
      }

      const items = parseItemsCell(itemsRaw);
      if (itemsRaw) rawItems.set(rowKey(sheetName, r), itemsRaw);

      if (!date) warnings.push(SpreadsheetWarningCode.MISSING_DATE);
      if (!invoiceNumber) warnings.push(SpreadsheetWarningCode.MISSING_INVOICE_NUMBER);
      if (!supplier) warnings.push(SpreadsheetWarningCode.MISSING_SUPPLIER);
      if (total === null) warnings.push(SpreadsheetWarningCode.MISSING_TOTAL);
      if (items.length === 0) {
        warnings.push(SpreadsheetWarningCode.NO_ITEMS);
      } else if (items.some((it) => it.confidence < 0.6)) {
        warnings.push(SpreadsheetWarningCode.UNPARSED_ITEMS);
      }

      result.push({
        sheet: sheetName,
        rowNumber: r,
        date,
        invoiceNumber,
        supplier,
        grossTotal: total,
        currency: '',
        odometerKm: odometer,
        paid,
        vehiclePlate: plate,
        matchedVehicleId: null,
        items,
        warnings,
        action: SpreadsheetRowAction.CREATE,
      });
    }

    return result;
  }
}

// ── Tiszta segédfüggvények (külön exportálva a unit-tesztekhez) ──────────────

/** Fejléc-cella normalizálása: kisbetű, ékezet le, csak betű/szám. */
export function normalizeHeader(value: string): string {
  return stripDiacritics((value ?? '').toLowerCase())
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Bevétel-munkalap felismerése a fül nevéből. */
export function isIncomeSheet(name: string): boolean {
  return /bev[eé]tel|venit|incom|incasari|încasări|incasare/i.test(name);
}

/**
 * A fül neve rendszámnak tűnik-e (jellemzően 4–10 alfanumerikus, számjeggyel).
 * Pl. "B104VLR" igen; "Remorka", "EGYEBB KOLTSEG", "Munkalap1" nem.
 */
export function looksLikePlate(name: string): boolean {
  const cleaned = (name ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (cleaned.length < 4 || cleaned.length > 10) return false;
  if (!/[0-9]/.test(cleaned) || !/[A-Za-z]/.test(cleaned)) return false;
  // Egyszavas, "munkalap1" / "sheet1" jellegű neveket kizárjuk.
  if (/^(munkalap|sheet|lap|foaie)\d*$/i.test(name.trim())) return false;
  return true;
}

function normalizePlateRaw(name: string): string {
  return name.replace(/\s+/g, '').toUpperCase();
}

/**
 * Fejléc keresése: az első néhány sorban az a sor, ahol legalább az "items"
 * (tétel) oszlop ÉS még legalább egy másik (dátum/számla/beszállító) felismerhető.
 */
export function findHeader(ws: ExcelJS.Worksheet): { rowIndex: number; columns: ColumnMap } | null {
  const maxRow = Math.min(ws.rowCount, HEADER_SCAN_ROWS);
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r);
    const columns = mapColumns(row);
    const known =
      (columns.date !== undefined ? 1 : 0) +
      (columns.invoiceNumber !== undefined ? 1 : 0) +
      (columns.supplier !== undefined ? 1 : 0);
    if (columns.items !== undefined && known >= 1) {
      return { rowIndex: r, columns };
    }
  }
  return null;
}

/**
 * Egy fejléc-sor oszlopainak leképezése. A "total" oszlopra van egy speciális
 * eset: ha nincs címke-egyezés, de egy cella maga SZÁM (a felhasználó a fejlécbe
 * a futó végösszeget írta), azt vesszük a végösszeg-oszlopnak.
 */
export function mapColumns(row: ExcelJS.Row): ColumnMap {
  const columns: ColumnMap = {};
  let numericHeaderCol: number | undefined;

  const colCount = Math.max(row.cellCount, row.actualCellCount);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    const raw = cellText(cell);
    const norm = normalizeHeader(raw);
    if (!norm) {
      // Üres címke, de számot tartalmaz? → lehetséges végösszeg-oszlop.
      if (numericHeaderCol === undefined && cellNumber(cell) !== null) {
        numericHeaderCol = c;
      }
      continue;
    }
    // Tisztán szám címke (pl. "9788.5") → futó végösszeg az oszlop tetején.
    if (/^[0-9]+$/.test(norm) && numericHeaderCol === undefined) {
      numericHeaderCol = c;
      continue;
    }
    for (const key of Object.keys(COLUMN_ALIASES) as (keyof ColumnMap)[]) {
      if (columns[key] !== undefined) continue;
      if (COLUMN_ALIASES[key].some((a) => norm === a || norm.startsWith(a))) {
        columns[key] = c;
        break;
      }
    }
  }

  if (columns.total === undefined && numericHeaderCol !== undefined) {
    columns.total = numericHeaderCol;
  }
  return columns;
}

/** A "Piese" cella feldarabolása tételekre (soronként egy tétel). */
export function parseItemsCell(text: string): SpreadsheetImportItem[] {
  const lines = splitLines(text);
  const items: SpreadsheetImportItem[] = [];
  for (const line of lines) {
    const item = parseItemLine(line);
    if (item) items.push(item);
  }
  return items;
}

/**
 * Egy tétel-sor bontása: a végéről mennyiség (+ esetleges mértékegység), az
 * elejéről egy óvatos cikkszám-minta; a maradék a megnevezés. Bármi hiányozhat:
 * amit nem talál, üresen hagyja (a felhasználó pótolja / az AI finomítja).
 */
export function parseItemLine(line: string): SpreadsheetImportItem | null {
  let rest = line.replace(/\s+/g, ' ').trim();
  if (!rest) return null;

  let quantity = 1;
  let unit: string | null = null;
  let foundQty = false;

  // Végső mennyiség (és előtte esetleg mértékegység).
  const qtyMatch = rest.match(/(\d+(?:[.,]\d+)?)\s*$/);
  if (qtyMatch) {
    const numStr = qtyMatch[1]!.replace(',', '.');
    const num = Number(numStr);
    if (Number.isFinite(num)) {
      const before = rest.slice(0, qtyMatch.index).trimEnd();
      // A trailing szó mértékegység? (csak akkor vágjuk le, ha ismert egység)
      const unitMatch = before.match(/([\p{L}.]+)\s*$/u);
      const maybeUnit = unitMatch ? unitMatch[1]!.replace(/\.$/, '').toLowerCase() : '';
      if (maybeUnit && KNOWN_UNITS.has(stripDiacritics(maybeUnit))) {
        unit = unitMatch![1]!.replace(/\.$/, '');
        rest = before.slice(0, unitMatch!.index).trimEnd();
      } else {
        rest = before;
      }
      quantity = num;
      foundQty = true;
    }
  }

  // Vezető cikkszám: numerikus (szóközökkel is, számra végződve) VAGY betű+szám
  // kód, aminek a farka már csak szám/pont (a megnevezés betűit nem nyeli el).
  let articleNumber: string | null = null;
  const codeMatch = rest.match(/^([0-9][0-9 ._\-\/]*[0-9]|[A-Za-z]{1,4}[0-9][0-9.\-\/]*)/);
  if (codeMatch) {
    const code = codeMatch[1]!.trim();
    const remainder = rest.slice(codeMatch[0].length).trim();
    // Csak akkor fogadjuk el kódnak, ha marad értelmes megnevezés is.
    if (remainder.length >= 2) {
      articleNumber = code.replace(/\s+/g, ' ');
      rest = remainder;
    }
  }

  const name = rest.trim();

  // Megbízhatóság: kód + név + mennyiség a legjobb; puszta név a leggyengébb.
  let confidence = 0.5;
  if (articleNumber && name) confidence = 0.75;
  if (foundQty && (articleNumber || name.length > 3)) confidence += 0.1;
  if (!name && !articleNumber) return null;
  confidence = Math.min(confidence, 0.9);

  return {
    articleNumber,
    name: name || (articleNumber ?? ''),
    quantity,
    unit,
    confidence,
  };
}

/** Sorokra bontás (CR/LF), trim, üresek eldobva. */
function splitLines(text: string): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

/** "IGEN/DA/YES" → true; "NEM/NU/NO" → false; egyébként null. */
export function parsePaid(value: string): boolean | null {
  const v = stripDiacritics((value ?? '').toLowerCase()).trim();
  if (!v) return null;
  if (/^(igen|da|yes|y|ok|true|1|achitat|platit|fizetve)/.test(v)) return true;
  if (/^(nem|nu|no|n|false|0|neplatit)/.test(v)) return false;
  return null;
}

// ── exceljs cella-olvasó segédek ─────────────────────────────────────────────

function cellText(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    // Rich text / formula / hyperlink alakok.
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText
        .map((rt) => rt.text)
        .join('')
        .trim();
    }
    if ('text' in v && typeof v.text === 'string') return v.text.trim();
    if ('result' in v) {
      const res = (v as ExcelJS.CellFormulaValue).result;
      return res === undefined || res === null ? '' : String(res).trim();
    }
  }
  return '';
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell?.value;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v && typeof v === 'object' && 'result' in v) {
    const res = (v as ExcelJS.CellFormulaValue).result;
    if (typeof res === 'number') return res;
  }
  const text = cellText(cell);
  return parseNumber(text);
}

function cellInt(cell: ExcelJS.Cell): number | null {
  const n = cellNumber(cell);
  return n === null ? null : Math.round(n);
}

function cellDateIso(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === 'object' && 'result' in v) {
    const res = (v as ExcelJS.CellFormulaValue).result;
    if (res instanceof Date) return res.toISOString().slice(0, 10);
  }
  return parseDateIso(cellText(cell));
}

/** Szöveg → szám (RON-os "35 539.35 RON", "1.234,56" alakok kezelésével). */
export function parseNumber(text: string): number | null {
  if (!text) return null;
  // Csak a szám-rész: betűk/pénznem le, szóközök (ezres elválasztó) ki.
  let s = text.replace(/[^\d.,\-]/g, '').trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Az utolsó elválasztó a tizedes; a másik ezres.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Csak vessző: tizedesnek vesszük.
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Szöveg → ISO dátum (YYYY-MM-DD). Több formátumot próbál; bizonytalan → ''. */
export function parseDateIso(text: string): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  // Már ISO?
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${pad2(iso[2]!)}-${pad2(iso[3]!)}`;
  }
  // DD.MM.YYYY vagy DD/MM/YYYY vagy YYYY.MM.DD
  const dmy = t.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${pad2(dmy[2]!)}-${pad2(dmy[1]!)}`;
  }
  const ymd = t.match(/^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${pad2(ymd[2]!)}-${pad2(ymd[3]!)}`;
  }
  return '';
}

function pad2(s: string): string {
  return s.padStart(2, '0');
}

/**
 * Alkatrész-típus (PartType) durva megsejtése a megnevezésből (RO/HU/EN
 * kulcsszavak). Csak segédlet az importhoz; null, ha nem egyértelmű.
 */
export function guessPartType(name: string): string | null {
  const n = stripDiacritics((name ?? '').toLowerCase());
  const has = (...keys: string[]) => keys.some((k) => n.includes(k));
  if (has('frana', 'placute', 'placuta', 'fek', 'brake', 'disc')) return 'brakes';
  if (has('filtru', 'filter', 'szuro')) return 'filters';
  if (has('ulei', 'olaj', 'oil', 'lichid', 'antigel', 'vaselina', 'fluid')) return 'fluids';
  if (has('anvelopa', 'cauciuc', 'gumi', 'tire', 'tyre')) return 'tires';
  if (has('amortizor', 'suspensie', 'rugo', 'arc', 'suspension')) return 'suspension';
  if (has('senzor', 'sensor', 'cablu', 'electric', 'bec', 'releu', 'baterie', 'far'))
    return 'electrical';
  if (has('curea', 'ambreiaj', 'cutie', 'transmisie', 'transmission')) return 'transmission';
  if (has('motor', 'injector', 'piston', 'garnitura', 'etansare', 'arzator', 'pompa'))
    return 'engine';
  if (has('caroserie', 'usa', 'capota', 'aripa', 'body', 'stergator', 'parbriz')) return 'body';
  return null;
}
