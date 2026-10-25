// @vitest-environment node
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { readSpreadsheetBatch, spreadsheetRowsPrompt } from "./spreadsheet-import";

function workbookBytes(bookType: "xls" | "xlsx" = "xlsx"): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ["Dutch", "English"],
    ...Array.from({ length: 27 }, (_, index) => [`woord ${index + 1}`, `word ${index + 1}`]),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Words");
  return XLSX.write(workbook, { bookType, type: "array" }) as ArrayBuffer;
}

describe("readSpreadsheetBatch", () => {
  it("keeps headers, ignores blank rows, and returns 25 labelled rows at a time", () => {
    const first = readSpreadsheetBatch(workbookBytes(), 0);
    const second = readSpreadsheetBatch(workbookBytes(), 25);

    expect(first).toMatchObject({ totalRows: 27, processedRows: 25, nextCursor: 25 });
    expect(first.rows).toHaveLength(25);
    expect(first.rows[0]).toEqual({
      sheetName: "Words",
      rowNumber: 2,
      values: [
        { header: "Dutch", value: "woord 1" },
        { header: "English", value: "word 1" },
      ],
    });
    expect(second).toMatchObject({ totalRows: 27, processedRows: 27, nextCursor: null });
    expect(second.rows).toHaveLength(2);
  });

  it("serializes row content as a JSON data payload", () => {
    const batch = readSpreadsheetBatch(workbookBytes(), 0);

    expect(spreadsheetRowsPrompt(batch.rows.slice(0, 1))).toBe(
      '[{"sheetName":"Words","rowNumber":2,"values":[{"header":"Dutch","value":"woord 1"},{"header":"English","value":"word 1"}]}]',
    );
  });

  it("parses legacy XLS workbooks", () => {
    const batch = readSpreadsheetBatch(workbookBytes("xls"), 0);

    expect(batch.rows[0]?.values).toEqual([
      { header: "Dutch", value: "woord 1" },
      { header: "English", value: "word 1" },
    ]);
  });
});
