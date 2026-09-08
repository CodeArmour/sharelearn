import { afterEach, describe, expect, it, vi } from "vitest";

import { downscaleImage, fitWithin, ImageDecodeError } from "./downscale-image";

describe("fitWithin", () => {
  it("scales a large landscape image to a 1600 px long edge", () => {
    expect(fitWithin(3200, 2400)).toEqual({ width: 1600, height: 1200 });
  });
  it("scales a large portrait image to a 1600 px long edge", () => {
    expect(fitWithin(1000, 4000)).toEqual({ width: 400, height: 1600 });
  });
  it("leaves a small image untouched", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("downscaleImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects with ImageDecodeError when the image can't be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("bad format")));
    await expect(downscaleImage(new File([], "x.heic"))).rejects.toBeInstanceOf(ImageDecodeError);
  });

  it("returns a JPEG blob sized to the fitted dimensions", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 3200, height: 2400, close: vi.fn() }),
    );
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
    const ctor = vi.fn(function OffscreenCanvasMock(this: Record<string, unknown>, w: number, h: number) {
      this.width = w;
      this.height = h;
      this.getContext = () => ({ drawImage });
      this.convertToBlob = convertToBlob;
    });
    vi.stubGlobal("OffscreenCanvas", ctor as unknown as typeof OffscreenCanvas);

    const blob = await downscaleImage(new File(["y"], "photo.jpg", { type: "image/jpeg" }));

    expect(ctor).toHaveBeenCalledWith(1600, 1200);
    expect(convertToBlob).toHaveBeenCalledWith({ type: "image/jpeg", quality: 0.82 });
    expect(blob.type).toBe("image/jpeg");
  });
});
