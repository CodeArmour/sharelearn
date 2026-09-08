/** The browser could not decode the picked image (most often HEIC outside
 *  Safari). The caller shows `add.ai.photos.rejectedFormat`. */
export class ImageDecodeError extends Error {
  constructor() {
    super("Could not decode image");
    this.name = "ImageDecodeError";
  }
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** Fit `width` × `height` inside a `maxEdge` square, preserving aspect ratio.
 *  Never upscales. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Re-encode a picked photo to a JPEG no larger than 1600 px on its long edge,
 * entirely in the browser. Keeps the Storage upload small and the vision call
 * cheap. Rejects with `ImageDecodeError` if the browser can't read the file.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageDecodeError();
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new ImageDecodeError();
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
}
