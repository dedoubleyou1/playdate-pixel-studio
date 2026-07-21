import { describe, expect, it } from "vitest";
import { defaultProjectPalette } from "./palette";
import {
  createDefaultImageImportMapping,
  createMappedImageImportSurface,
  downscaleImageNearest,
  prepareExactImageImport,
  prepareSegmentedImageImport,
  type DecodedImportImage,
} from "./imageImport";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";

describe("image import preparation", () => {
  it("extracts exact colors after alpha thresholding", () => {
    const image = decodedImage(2, 2, [0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 127, 255, 0, 0, 255]);

    const result = prepareExactImageImport(image);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.import.entries.map((entry) => entry.id)).toEqual([
      "transparent",
      "exact:000000",
      "exact:ff0000",
      "exact:ffffff",
    ]);
    expect(result.import.entries.map((entry) => entry.pixelCount)).toEqual([1, 1, 1, 1]);
  });

  it("rejects exact import when the native image is too large", () => {
    const result = prepareExactImageImport(decodedImage(3, 2, solidPixels(3, 2, 0, 0, 0)), { maxDimension: 2 });

    expect(result).toEqual({
      ok: false,
      rejection: { reason: "too-large", width: 3, height: 2, limit: 2 },
    });
  });

  it("rejects exact import above the exact color limit", () => {
    const result = prepareExactImageImport(decodedImage(3, 1, [0, 0, 0, 255, 1, 1, 1, 255, 2, 2, 2, 255]), {
      maxColors: 2,
    });

    expect(result).toEqual({
      ok: false,
      rejection: { reason: "too-many-colors", colorCount: 3, limit: 2 },
    });
  });

  it("creates deterministic default mappings across the current palette ramp", () => {
    const image = decodedImage(3, 1, [0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
    const result = prepareExactImageImport(image);
    if (!result.ok) throw new Error("Expected exact import");

    const mapping = createDefaultImageImportMapping(result.import, defaultProjectPalette());

    expect(mapping["exact:000000"]).toBe(BLACK_PIXEL);
    expect(mapping["exact:ffffff"]).toBe(WHITE_PIXEL);
    expect(mapping["exact:808080"]).not.toBe(TRANSPARENT_PIXEL);
  });

  it("creates mapped surfaces from prepared import entries", () => {
    const image = decodedImage(2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
    const result = prepareExactImageImport(image);
    if (!result.ok) throw new Error("Expected exact import");

    const surface = createMappedImageImportSurface(result.import, {
      "exact:000000": BLACK_PIXEL,
      "exact:ffffff": WHITE_PIXEL,
      transparent: TRANSPARENT_PIXEL,
    });

    expect(surface.width).toBe(2);
    expect(surface.height).toBe(1);
    expect([...surface.data]).toEqual([BLACK_PIXEL, WHITE_PIXEL]);
  });

  it("downscales using nearest neighbor without introducing blended colors", () => {
    const image = decodedImage(
      4,
      4,
      [
        255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
        0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 255, 255, 0, 0,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      ],
    );

    const scaled = downscaleImageNearest(image, 2);
    const colors = uniqueOpaqueColors(scaled);

    expect(scaled.width).toBe(2);
    expect(scaled.height).toBe(2);
    expect([...colors].sort()).toEqual(["0000ff", "00ff00", "ff0000", "ffffff"]);
  });

  it("segments high-color images into a bounded set of mapping entries", () => {
    const pixels: number[] = [];
    for (let value = 0; value < 16; value += 1) {
      pixels.push(value, value, value, 255);
    }

    const prepared = prepareSegmentedImageImport(decodedImage(16, 1, pixels), { maxSegments: 2 });

    expect(prepared.mode).toBe("segment");
    expect(prepared.entries.filter((entry) => entry.kind === "segment").length).toBeLessThanOrEqual(2);
  });
});

function decodedImage(width: number, height: number, pixels: number[]): DecodedImportImage {
  return {
    fileName: "test.png",
    height,
    mimeType: "image/png",
    pixels: new Uint8ClampedArray(pixels),
    width,
  };
}

function solidPixels(width: number, height: number, red: number, green: number, blue: number): number[] {
  return Array.from({ length: width * height }, () => [red, green, blue, 255]).flat();
}

function uniqueOpaqueColors(image: DecodedImportImage): Set<string> {
  const colors = new Set<string>();
  for (let index = 0; index < image.pixels.length; index += 4) {
    if (image.pixels[index + 3] === 0) continue;
    colors.add(
      `${image.pixels[index].toString(16).padStart(2, "0")}${image.pixels[index + 1]
        .toString(16)
        .padStart(2, "0")}${image.pixels[index + 2].toString(16).padStart(2, "0")}`,
    );
  }
  return colors;
}
