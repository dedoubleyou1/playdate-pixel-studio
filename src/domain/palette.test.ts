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

  it("resolves the built-in black-over-white pattern ramp", () => {
    const palette = defaultProjectPalette();

    expect(resolvePaletteEntry(palette, 3, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 3, { x: 1, y: 0 })).toBe(WHITE_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 1, y: 0 })).toBe(WHITE_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 1, y: 1 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 5, { x: 0, y: 1 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 5, { x: 1, y: 1 })).toBe(WHITE_PIXEL);
  });

  it("applies pattern sampling offsets visually", () => {
    const palette: ProjectPalette = {
      entries: [
        { id: "alpha", index: 0, name: "Transparent", type: "solid", value: "alpha" },
        { id: "black", index: 1, name: "Black", type: "solid", value: "black" },
        { id: "white", index: 2, name: "White", type: "solid", value: "white" },
        {
          id: "offset",
          index: 3,
          name: "Offset",
          type: "pattern",
          patternId: "checker-50",
          previewHue: 210,
          offsetX: 1,
          offsetY: 0,
          reflectX: false,
          reflectY: false,
          rotation: 0,
        },
      ],
    };

    expect(resolvePaletteEntry(palette, 3, { x: 0, y: 0 })).toBe(WHITE_PIXEL);
    expect(resolvePaletteEntry(palette, 3, { x: 1, y: 0 })).toBe(BLACK_PIXEL);
  });

  it("applies pattern rotations and reflections", () => {
    const palette: ProjectPalette = {
      entries: [
        { id: "alpha", index: 0, name: "Transparent", type: "solid", value: "alpha" },
        { id: "black", index: 1, name: "Black", type: "solid", value: "black" },
        { id: "white", index: 2, name: "White", type: "solid", value: "white" },
        {
          id: "rotated",
          index: 3,
          name: "Rotated",
          type: "pattern",
          patternId: "hatch-vertical",
          previewHue: 210,
          offsetX: 0,
          offsetY: 0,
          reflectX: false,
          reflectY: false,
          rotation: 90,
        },
        {
          id: "reflected",
          index: 4,
          name: "Reflected",
          type: "pattern",
          patternId: "stair-step",
          previewHue: 300,
          offsetX: 0,
          offsetY: 0,
          reflectX: true,
          reflectY: false,
          rotation: 0,
        },
      ],
    };

    expect(resolvePaletteEntry(palette, 3, { x: 1, y: 0 })).toBe(BLACK_PIXEL);
    expect(resolvePaletteEntry(palette, 3, { x: 0, y: 1 })).toBe(WHITE_PIXEL);
    expect(resolvePaletteEntry(palette, 4, { x: 1, y: 0 })).toBe(WHITE_PIXEL);
  });

  it("normalizes unknown entries to alpha labels and values", () => {
    const palette = defaultProjectPalette();

    expect(resolvePaletteEntry(palette, 99, { x: 0, y: 0 })).toBe(TRANSPARENT_PIXEL);
    expect(paletteEntryLabel(palette, 99)).toBe("Transparent");
    expect(solidPaletteValueToIndex("white")).toBe(WHITE_PIXEL);
  });

  it("resolves colorized pattern previews from swatch hues", () => {
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

  it("keeps colorized preview hues on swatches when pattern IDs change", () => {
    const palette: ProjectPalette = {
      entries: [
        { id: "alpha", index: 0, name: "Transparent", type: "solid", value: "alpha" },
        { id: "black", index: 1, name: "Black", type: "solid", value: "black" },
        { id: "white", index: 2, name: "White", type: "solid", value: "white" },
        {
          id: "blue-dots",
          index: 3,
          name: "Blue Dots",
          type: "pattern",
          patternId: "dots-grid",
          previewHue: 210,
          offsetX: 0,
          offsetY: 0,
          reflectX: false,
          reflectY: false,
          rotation: 0,
        },
        {
          id: "magenta-dots",
          index: 4,
          name: "Magenta Dots",
          type: "pattern",
          patternId: "dots-grid",
          previewHue: 300,
          offsetX: 0,
          offsetY: 0,
          reflectX: false,
          reflectY: false,
          rotation: 0,
        },
      ],
    };

    expect(resolvePaletteEntryPreviewColor(palette, 3, { x: 0, y: 0 }, { colorizedPatterns: true })).toEqual({
      r: 0,
      g: 64,
      b: 128,
    });
    expect(resolvePaletteEntryPreviewColor(palette, 4, { x: 0, y: 0 }, { colorizedPatterns: true })).toEqual({
      r: 128,
      g: 0,
      b: 128,
    });
  });
});
