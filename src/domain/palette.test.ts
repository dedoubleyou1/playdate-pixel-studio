import { describe, expect, it } from "vitest";
import { defaultProjectPalette, paletteEntryLabel, resolvePaletteEntry, solidPaletteValueToIndex } from "./palette";
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
        { id: "alpha", index: 0, name: "Alpha", type: "solid", value: "alpha" },
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
    expect(paletteEntryLabel(palette, 99)).toBe("Alpha");
    expect(solidPaletteValueToIndex("white")).toBe(WHITE_PIXEL);
  });
});
