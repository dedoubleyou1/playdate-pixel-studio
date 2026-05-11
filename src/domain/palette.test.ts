import { describe, expect, it } from "vitest";
import {
  defaultProjectPalette,
  paletteEntryLabel,
  resolvePaletteEntry,
  resolvePaletteEntryPreviewColor,
  solidPaletteValueToIndex,
} from "./palette";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import type { ProjectPalette } from "./types";

describe("palette resolver", () => {
  it("resolves solid alpha, black, and white entries", () => {
    const palette = defaultProjectPalette();

    expect(resolvePaletteEntry(palette, TRANSPARENT_PIXEL, { x: 0, y: 0 })).toBe(TRANSPARENT_PIXEL);
    expect(resolvePaletteEntry(palette, BLACK_PIXEL, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, WHITE_PIXEL, { x: 0, y: 0 })).toBe(WHITE_PIXEL);
  });

  it("resolves the built-in black-over-white dither ramp", () => {
    const palette = defaultProjectPalette();

    expect(resolvePaletteEntry(palette, 3, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 3, { x: 1, y: 0 })).toBe(WHITE_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 1, y: 0 })).toBe(WHITE_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 1, y: 1 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 5, { x: 0, y: 1 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 5, { x: 1, y: 1 })).toBe(WHITE_PIXEL);
  });

  it("resolves foreground and background references recursively", () => {
    const palette: ProjectPalette = {
      entries: [
        { id: "alpha", index: 0, name: "Transparent", type: "solid", value: "alpha" },
        { id: "black", index: 1, name: "Black", type: "solid", value: "black" },
        { id: "white", index: 2, name: "White", type: "solid", value: "white" },
        {
          id: "nested",
          index: 3,
          name: "Nested",
          type: "dither",
          patternId: "checker-50",
          foregroundIndex: 1,
          backgroundIndex: 2,
        },
        {
          id: "recursive",
          index: 4,
          name: "Recursive",
          type: "dither",
          patternId: "checker-50",
          foregroundIndex: 3,
          backgroundIndex: 0,
        },
      ],
    };

    expect(resolvePaletteEntry(palette, 4, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 1, y: 0 })).toBe(TRANSPARENT_PIXEL);
  });

  it("normalizes unknown entries to alpha labels and values", () => {
    const palette = defaultProjectPalette();

    expect(resolvePaletteEntry(palette, 99, { x: 0, y: 0 })).toBe(TRANSPARENT_PIXEL);
    expect(paletteEntryLabel(palette, 99)).toBe("Transparent");
    expect(solidPaletteValueToIndex("white")).toBe(WHITE_PIXEL);
  });

  it("resolves colorized dither previews from pattern hue and mask cells", () => {
    const palette = defaultProjectPalette();

    expect(resolvePaletteEntryPreviewColor(palette, 3, { x: 0, y: 0 }, { colorizedPatterns: true })).toEqual({
      r: 0,
      g: 64,
      b: 128,
    });
    expect(resolvePaletteEntryPreviewColor(palette, 3, { x: 1, y: 0 }, { colorizedPatterns: true })).toEqual({
      r: 191,
      g: 223,
      b: 255,
    });
    expect(resolvePaletteEntryPreviewColor(palette, BLACK_PIXEL, { x: 0, y: 0 }, { colorizedPatterns: true })).toEqual({
      r: 0,
      g: 0,
      b: 0,
    });
    expect(resolvePaletteEntryPreviewColor(palette, WHITE_PIXEL, { x: 0, y: 0 }, { colorizedPatterns: true })).toEqual({
      r: 255,
      g: 255,
      b: 255,
    });
    expect(
      resolvePaletteEntryPreviewColor(palette, TRANSPARENT_PIXEL, { x: 0, y: 0 }, { colorizedPatterns: true }),
    ).toBeNull();
  });
});
