/**
 * Excel (XLSX/XLS) köteges számla-import szerződése.
 *
 * Sok fuvarozó kézzel vezetett Excel-naplóban tartja a szerviz-/költség-
 * előzményt: munkalaponként egy jármű (a fül neve a rendszám), soronként egy
 * számla, a tételek pedig egyetlen "Piese" cellában, soronként felsorolva.
 *
 * Ez NEM a kép-OCR pipeline: az Excel cellái már strukturált szövegek, ezért
 * külön köteges-import úton dolgozzuk fel (előnézet → megerősítés), és egy fájl
 * SOK számlát hozhat létre. A felismert sorokat ugyanarra az `ExtractionResult`
 * alakra képezzük, mint az OCR-motor, így a beszállító-/jármű-matching és a
 * perzisztálás újrahasználható.
 */

/** Engedélyezett táblázat-MIME-ek (a kép-OCR feltöltéstől KÜLÖN kezelve). */
export const SPREADSHEET_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
] as const;

export type SpreadsheetMimeType = (typeof SPREADSHEET_MIME_TYPES)[number];

export const SPREADSHEET_EXTENSIONS = ['xlsx', 'xls'] as const;

export function isSpreadsheetMimeType(mime: string): mime is SpreadsheetMimeType {
  return (SPREADSHEET_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Soronkénti figyelmeztetések. NEM dobjuk el a sort: a hiányzó mezőket üresen
 * hagyjuk, és a felhasználó figyelmét felhívjuk (az előnézetben kiemelve), hogy
 * pótolja a véglegesítés előtt vagy után.
 */
export const SpreadsheetWarningCode = {
  /** Nincs (felismerhető) dátum a sorban. */
  MISSING_DATE: 'MISSING_DATE',
  /** Nincs számlaszám. */
  MISSING_INVOICE_NUMBER: 'MISSING_INVOICE_NUMBER',
  /** Nincs beszállító (cég). */
  MISSING_SUPPLIER: 'MISSING_SUPPLIER',
  /** Nincs (értelmezhető) végösszeg. */
  MISSING_TOTAL: 'MISSING_TOTAL',
  /** A fül/sor alapján nem azonosítható jármű (rendszám nem egyezik meglévővel). */
  MISSING_VEHICLE: 'MISSING_VEHICLE',
  /** A sorban egyetlen tételt sem sikerült kiolvasni. */
  NO_ITEMS: 'NO_ITEMS',
  /** Néhány tétel-sor nem volt tisztán bontható (cikkszám/név bizonytalan). */
  UNPARSED_ITEMS: 'UNPARSED_ITEMS',
  /** Több számlaszám szerepel egy cellában (az elsőt vettük fő számlaszámnak). */
  MULTIPLE_INVOICE_NUMBERS: 'MULTIPLE_INVOICE_NUMBERS',
  /** Több beszállító szerepel egy cellában (az elsőt vettük). */
  MULTIPLE_SUPPLIERS: 'MULTIPLE_SUPPLIERS',
} as const;

export type SpreadsheetWarningCode =
  (typeof SpreadsheetWarningCode)[keyof typeof SpreadsheetWarningCode];

/** Egy kiolvasott tétel az Excel "Piese" (tétel) cellájából. */
export interface SpreadsheetImportItem {
  /** Felismert cikkszám/cikkkód, ha tisztán elválasztható – különben null. */
  articleNumber: string | null;
  /** A tétel megnevezése (a sorból, a cikkszám/mennyiség levonása után). */
  name: string;
  /** Mennyiség (alapból 1, ha nincs felismerve). */
  quantity: number;
  /** Mértékegység szövegként (BUC, db, L, SET…), ha szerepelt – különben null. */
  unit: string | null;
  /** 0–1 megbízhatóság (a determinisztikus bontás biztossága). */
  confidence: number;
}

/** A véglegesítéskor alkalmazandó művelet egy sorra. */
export const SpreadsheetRowAction = {
  /** Új számla jön létre. */
  CREATE: 'create',
  /** Ugyanez a sor (fájl-hash + munkalap + tartalom) már importálva volt – kihagyjuk. */
  DUPLICATE: 'duplicate',
  /** Üres/érdemi adat nélküli sor – nem hozunk létre belőle semmit. */
  SKIP: 'skip',
} as const;

export type SpreadsheetRowAction = (typeof SpreadsheetRowAction)[keyof typeof SpreadsheetRowAction];

/** Egy felismert számla-sor az Excel-ből (előnézethez). */
export interface SpreadsheetImportRow {
  /** A munkalap (fül) neve – ez gyakran a jármű rendszáma. */
  sheet: string;
  /** A sor száma az Excel-ben (1-alapú, a fejléccel együtt). */
  rowNumber: number;
  /** ISO dátum (YYYY-MM-DD), ha értelmezhető – különben üres. */
  date: string;
  /** Fő számlaszám (több esetén az első). */
  invoiceNumber: string;
  /** Beszállító neve (több esetén az első). */
  supplier: string;
  /** Bruttó végösszeg, ha értelmezhető – különben null. */
  grossTotal: number | null;
  /** Pénznem (pl. RON), ha kiolvasható – különben üres. */
  currency: string;
  /** Kilométeróra-állás, ha szerepelt – különben null. */
  odometerKm: number | null;
  /** Ki van fizetve (IGEN/DA/YES → true; NEM/NU/NO → false; ismeretlen → null). */
  paid: boolean | null;
  /** A fül nevéből/sorból sejtett rendszám (nyers). */
  vehiclePlate: string | null;
  /** A meglévő jármű id-je, ha a rendszám egyezik – különben null. */
  matchedVehicleId: string | null;
  /** A kiolvasott tételek. */
  items: SpreadsheetImportItem[];
  /** Soronkénti figyelmeztetések (hiányzó/bizonytalan adatok). */
  warnings: SpreadsheetWarningCode[];
  /** Véglegesítéskori művelet. */
  action: SpreadsheetRowAction;
}

/** Egy munkalap összegzése az előnézetben. */
export interface SpreadsheetSheetSummary {
  /** A fül neve. */
  name: string;
  /** A felismert jármű rendszáma (a fül nevéből), ha van. */
  vehiclePlate: string | null;
  /** A meglévő jármű id-je, ha egyezik. */
  matchedVehicleId: string | null;
  /** Hány adatsort tartalmaz (a fejléc nélkül). */
  rowCount: number;
  /** Kihagyva-e a munkalap (bevétel-fül vagy üres), és miért. */
  skipped: boolean;
  /** Kihagyás oka (i18n kulcs-rész): 'income' | 'empty' | 'no_columns'. */
  skipReason?: 'income' | 'empty' | 'no_columns';
}

/** A teljes előnézet (NEM ír semmit). */
export interface SpreadsheetImportPreview {
  sheets: SpreadsheetSheetSummary[];
  rows: SpreadsheetImportRow[];
  summary: {
    /** Összes felismert adatsor. */
    total: number;
    /** Létrehozandó számlák száma. */
    create: number;
    /** Korábbról már importált (kihagyandó) sorok. */
    duplicate: number;
    /** Üres/kihagyott sorok. */
    skip: number;
    /** Hány sornak van legalább egy figyelmeztetése. */
    withWarnings: number;
  };
}

/** A véglegesítés eredménye. */
export interface SpreadsheetImportCommitResult {
  /** Létrehozott számlák száma. */
  created: number;
  /** Már létező (kihagyott) sorok. */
  skipped: number;
  /** Soronkénti hibák (a sor száma + üzenet). */
  errors: { sheet: string; rowNumber: number; message: string }[];
}
