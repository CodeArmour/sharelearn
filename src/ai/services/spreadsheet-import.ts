import "server-only";

import * as XLSX from "xlsx";

export const SPREADSHEET_BATCH_SIZE = 25;
export const MAX_SPREADSHEET_ROWS = 5_000;

const MAX_SPREADSHEET_COLUMNS = 24;
const MAX_CELL_LENGTH = 300;

export type SpreadsheetRow = {
  sheetName: string;
  rowNumber: number;
  values: { header: string; value: string }[];
};

export type SpreadsheetBatch = {
  rows: SpreadsheetRow[];
  totalRows: number;
  processedRows: number;
  nextCursor: number | null;
};

function cellText(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, MAX_CELL_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return "";
}

function nonEmptyRow(row: unknown[]): boolean {
  return row.some((value) => cellText(value).length > 0);
}

function headersFrom(row: unknown[]): string[] {
  return row.slice(0, MAX_SPREADSHEET_COLUMNS).map((value, index) => {
    const header = cellText(value);
    return header || `Column ${index + 1}`;
  });
}

function rowsFromWorkbook(workbook: XLSX.WorkBook): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const table = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    });
    const headerIndex = table.findIndex(nonEmptyRow);
    if (headerIndex === -1) continue;

    const headers = headersFrom(table[headerIndex]);
    for (let index = headerIndex + 1; index < table.length; index += 1) {
      const dataRow = table[index];
      if (!nonEmptyRow(dataRow)) continue;

      const values = headers
        .map((header, column) => ({ header, value: cellText(dataRow[column]) }))
        .filter((entry) => entry.value.length > 0);
      if (values.length > 0) rows.push({ sheetName, rowNumber: index + 1, values });
    }
  }

  return rows;
}

export function readSpreadsheetBatch(data: ArrayBuffer, cursor: number): SpreadsheetBatch {
  const workbook = XLSX.read(Buffer.from(data), {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    cellNF: false,
  });
  const allRows = rowsFromWorkbook(workbook);
  if (allRows.length > MAX_SPREADSHEET_ROWS) {
    throw new Error(`Spreadsheet has more than ${MAX_SPREADSHEET_ROWS} data rows`);
  }

  const safeCursor = Math.min(Math.max(cursor, 0), allRows.length);
  const rows = allRows.slice(safeCursor, safeCursor + SPREADSHEET_BATCH_SIZE);
  const processedRows = safeCursor + rows.length;

  return {
    rows,
    totalRows: allRows.length,
    processedRows,
    nextCursor: processedRows < allRows.length ? processedRows : null,
  };
}

export function spreadsheetRowsPrompt(rows: SpreadsheetRow[]): string {
  return JSON.stringify(rows);
}
