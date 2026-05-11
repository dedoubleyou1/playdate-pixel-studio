import {
  BLACK_PIXEL,
  MAX_PALETTE_INDEX,
  TRANSPARENT_PIXEL,
  WHITE_PIXEL,
  type PaletteEntry,
  type PaletteIndex,
  type Point,
  type ProjectPalette,
  type SolidPaletteValue,
} from "./types";

export const FIRST_DITHER_PALETTE_INDEX = 3;

export interface DitherPattern {
  id: string;
  name: string;
  hue: number;
  width: number;
  height: number;
  mask: boolean[];
}

export interface PalettePreviewColor {
  r: number;
  g: number;
  b: number;
}

interface PalettePreviewOptions {
  colorizedPatterns?: boolean;
}

export const BUILT_IN_DITHER_PATTERNS: DitherPattern[] = [
  {
    id: "checker-25",
    name: "25%",
    hue: 210,
    width: 2,
    height: 2,
    mask: [true, false, false, false],
  },
  {
    id: "checker-50",
    name: "50%",
    hue: 300,
    width: 2,
    height: 2,
    mask: [true, false, false, true],
  },
  {
    id: "checker-75",
    name: "75%",
    hue: 120,
    width: 2,
    height: 2,
    mask: [true, true, true, false],
  },
];

export function defaultProjectPalette(): ProjectPalette {
  return {
    entries: [
      { id: "alpha", index: TRANSPARENT_PIXEL, name: "Transparent", type: "solid", value: "alpha" },
      { id: "black", index: BLACK_PIXEL, name: "Black", type: "solid", value: "black" },
      { id: "white", index: WHITE_PIXEL, name: "White", type: "solid", value: "white" },
      {
        id: "black-white-25",
        index: 3,
        name: "25% Black",
        type: "dither",
        patternId: "checker-25",
        foregroundIndex: BLACK_PIXEL,
        backgroundIndex: WHITE_PIXEL,
      },
      {
        id: "black-white-50",
        index: 4,
        name: "50% Black",
        type: "dither",
        patternId: "checker-50",
        foregroundIndex: BLACK_PIXEL,
        backgroundIndex: WHITE_PIXEL,
      },
      {
        id: "black-white-75",
        index: 5,
        name: "75% Black",
        type: "dither",
        patternId: "checker-75",
        foregroundIndex: BLACK_PIXEL,
        backgroundIndex: WHITE_PIXEL,
      },
    ],
  };
}

export function normalizePaletteIndex(value: number): PaletteIndex {
  if (!Number.isInteger(value) || value < 0 || value > MAX_PALETTE_INDEX) return TRANSPARENT_PIXEL;
  return value;
}

export function paletteEntryForIndex(palette: ProjectPalette, index: PaletteIndex): PaletteEntry | null {
  return palette.entries.find((entry) => entry.index === index) ?? null;
}

export function paletteEntryLabel(palette: ProjectPalette, index: PaletteIndex): string {
  return paletteEntryForIndex(palette, index)?.name ?? "Transparent";
}

export function projectPaletteKey(palette: ProjectPalette): string {
  return palette.entries
    .map((entry) =>
      entry.type === "solid"
        ? `${entry.index}:${entry.type}:${entry.value}`
        : `${entry.index}:${entry.type}:${entry.patternId}:${entry.foregroundIndex}:${entry.backgroundIndex}`,
    )
    .join("|");
}

export function resolvePaletteEntry(
  palette: ProjectPalette,
  index: PaletteIndex,
  point: Point,
): typeof TRANSPARENT_PIXEL | typeof BLACK_PIXEL | typeof WHITE_PIXEL {
  return resolvePaletteIndex(palette, normalizePaletteIndex(index), point, new Set());
}

export function resolvePaletteEntryPreviewColor(
  palette: ProjectPalette,
  index: PaletteIndex,
  point: Point,
  options: PalettePreviewOptions = {},
): PalettePreviewColor | null {
  const paletteIndex = normalizePaletteIndex(index);
  const entry = paletteEntryForIndex(palette, paletteIndex);
  const pixel = resolvePaletteIndex(palette, paletteIndex, point, new Set());

  if (options.colorizedPatterns && entry?.type === "dither") {
    const pattern = builtInDitherPattern(entry.patternId);
    if (pattern && pixel !== TRANSPARENT_PIXEL) {
      return hsvToRgb(pattern.hue, pixel === WHITE_PIXEL ? 0.25 : 1, pixel === WHITE_PIXEL ? 1 : 0.5);
    }
  }

  if (pixel === BLACK_PIXEL) return { r: 0, g: 0, b: 0 };
  if (pixel === WHITE_PIXEL) return { r: 255, g: 255, b: 255 };
  return null;
}

export function solidPaletteValueToIndex(
  value: SolidPaletteValue,
): typeof TRANSPARENT_PIXEL | typeof BLACK_PIXEL | typeof WHITE_PIXEL {
  if (value === "black") return BLACK_PIXEL;
  if (value === "white") return WHITE_PIXEL;
  return TRANSPARENT_PIXEL;
}

export function ditherPatternAt(patternId: string, point: Point): boolean {
  const pattern = BUILT_IN_DITHER_PATTERNS.find((candidate) => candidate.id === patternId);
  if (!pattern) return false;

  const x = positiveModulo(point.x, pattern.width);
  const y = positiveModulo(point.y, pattern.height);
  return pattern.mask[y * pattern.width + x] ?? false;
}

export function builtInDitherPattern(patternId: string): DitherPattern | null {
  return BUILT_IN_DITHER_PATTERNS.find((candidate) => candidate.id === patternId) ?? null;
}

function resolvePaletteIndex(
  palette: ProjectPalette,
  index: PaletteIndex,
  point: Point,
  seen: Set<PaletteIndex>,
): typeof TRANSPARENT_PIXEL | typeof BLACK_PIXEL | typeof WHITE_PIXEL {
  if (seen.has(index)) return TRANSPARENT_PIXEL;
  seen.add(index);

  const entry = paletteEntryForIndex(palette, index);
  if (!entry) return TRANSPARENT_PIXEL;
  if (entry.type === "solid") return solidPaletteValueToIndex(entry.value);

  const nextIndex = ditherPatternAt(entry.patternId, point) ? entry.foregroundIndex : entry.backgroundIndex;
  return resolvePaletteIndex(palette, normalizePaletteIndex(nextIndex), point, seen);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hsvToRgb(hue: number, saturation: number, value: number): PalettePreviewColor {
  const normalizedHue = positiveModulo(hue, 360) / 60;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((normalizedHue % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (normalizedHue < 1) {
    red = chroma;
    green = secondary;
  } else if (normalizedHue < 2) {
    red = secondary;
    green = chroma;
  } else if (normalizedHue < 3) {
    green = chroma;
    blue = secondary;
  } else if (normalizedHue < 4) {
    green = secondary;
    blue = chroma;
  } else if (normalizedHue < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
}
