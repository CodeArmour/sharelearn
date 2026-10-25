import { describe, expect, it, vi } from "vitest";

vi.mock("./downscale-image", () => ({
  downscaleImage: vi.fn().mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" })),
}));

import { downscaleImage } from "./downscale-image";

import {
  isCaptureImage,
  isSupportedCaptureFile,
  MAX_CAPTURE_FILE_BYTES,
  prepareCaptureFile,
} from "./capture-files";

describe("capture files", () => {
  it("accepts images, PDFs, and Excel workbooks", () => {
    expect(isSupportedCaptureFile(new File(["x"], "notes.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(
      isSupportedCaptureFile(new File(["x"], "worksheet.pdf", { type: "application/pdf" })),
    ).toBe(true);
    expect(
      isSupportedCaptureFile(new File(["x"], "words.xls", { type: "application/vnd.ms-excel" })),
    ).toBe(true);
    expect(
      isSupportedCaptureFile(
        new File(["x"], "words.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ),
    ).toBe(true);
  });

  it("does not accept unrelated files", () => {
    expect(isSupportedCaptureFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(
      false,
    );
    expect(MAX_CAPTURE_FILE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("re-encodes images as JPEGs", async () => {
    const source = new File(["x"], "notes.png", { type: "image/png" });
    expect(isCaptureImage(source)).toBe(true);

    await expect(prepareCaptureFile(source)).resolves.toMatchObject({
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(downscaleImage).toHaveBeenCalledWith(source);
  });

  it("keeps supported document bytes and assigns their canonical MIME type", async () => {
    const workbook = new File(["sheet"], "woorden.xlsx", { type: "" });
    await expect(prepareCaptureFile(workbook)).resolves.toEqual({
      content: workbook,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    });
  });
});
