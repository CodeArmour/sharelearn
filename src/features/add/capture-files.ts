import { downscaleImage } from "./downscale-image";

export const MAX_CAPTURE_FILES = 3;
export const MAX_CAPTURE_FILE_BYTES = 5 * 1024 * 1024;

export type CaptureFileExtension = "jpg" | "pdf" | "xls" | "xlsx";

export interface PreparedCaptureFile {
  content: Blob;
  contentType: string;
  extension: CaptureFileExtension;
}

const DOCUMENT_CONTENT_TYPES: Record<Exclude<CaptureFileExtension, "jpg">, string> = {
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function extensionOf(file: File): string {
  const dot = file.name.lastIndexOf(".");
  return dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
}

/** Images are always re-encoded to JPEG before upload, so their original
 * extension and browser-reported MIME type never reach the server action. */
export function isCaptureImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const extension = extensionOf(file);
  return extension === "heic" || extension === "heif";
}

export function isSupportedCaptureFile(file: File): boolean {
  return isCaptureImage(file) || ["pdf", "xls", "xlsx"].includes(extensionOf(file));
}

/** Convert images for economical vision input; keep document bytes intact so
 * the Responses API can apply its native PDF/spreadsheet processing. */
export async function prepareCaptureFile(file: File): Promise<PreparedCaptureFile> {
  if (isCaptureImage(file)) {
    return {
      content: await downscaleImage(file),
      contentType: "image/jpeg",
      extension: "jpg",
    };
  }

  const extension = extensionOf(file) as Exclude<CaptureFileExtension, "jpg">;
  const contentType = DOCUMENT_CONTENT_TYPES[extension];
  if (!contentType) throw new Error("Unsupported capture file");

  return { content: file, contentType, extension };
}
