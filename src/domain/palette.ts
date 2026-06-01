import {
  BLACK_PIXEL,
  MAX_PALETTE_INDEX,
  TRANSPARENT_PIXEL,
  WHITE_PIXEL,
  type PaletteEntry,
  type PaletteIndex,
  type PatternPaletteEntry,
  type Point,
  type ProjectPalette,
  type SolidPaletteValue,
} from "./types";
import {
  DEFAULT_PATTERN_SAMPLING,
  PATTERN_LIBRARY_VERSION,
  builtInPattern,
  samplePatternAt,
} from "./patterns";

export const FIRST_PATTERN_PALETTE_INDEX = 3;
const PATTERN_PREVIEW_HUES = [210, 300, 120, 25, 180, 260, 55, 330, 150, 230, 10, 285];

export interface PalettePreviewColor {
  r: number;
  g: number;
  b: number;
}

interface PalettePreviewOptions {
  colorizedPatterns?: boolean;
}

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
        type: "pattern",
        patternId: "checker-25",
        previewHue: 210,
        ...DEFAULT_PATTERN_SAMPLING,
      },
      {
        id: "black-white-50",
        index: 4,
        name: "50% Black",
        type: "pattern",
        patternId: "checker-50",
        previewHue: 300,
        ...DEFAULT_PATTERN_SAMPLING,
      },
      {
        id: "black-white-75",
        index: 5,
        name: "75% Black",
        type: "pattern",
        patternId: "checker-75",
        previewHue: 120,
        ...DEFAULT_PATTERN_SAMPLING,
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
        : `${entry.index}:${entry.type}:${entry.patternId}:${patternSamplingKey(entry)}:${entry.previewHue}`,
    )
    .join("|")
    .concat(`:patterns-v${PATTERN_LIBRARY_VERSION}`);
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

  if (options.colorizedPatterns && entry?.type === "pattern") {
    const pattern = builtInPattern(entry.patternId);
    if (pattern && pixel !== TRANSPARENT_PIXEL) {
      return hsvToRgb(entry.previewHue, pixel === WHITE_PIXEL ? 0.25 : 1, pixel === WHITE_PIXEL ? 1 : 0.5);
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

export function patternSamplingKey(entry: PatternPaletteEntry): string {
  return `${entry.offsetX},${entry.offsetY},${entry.rotation},${entry.reflectX ? 1 : 0},${entry.reflectY ? 1 : 0}`;
}

export function nextPatternPaletteIndex(palette: ProjectPalette): PaletteIndex | null {
  const used = new Set(palette.entries.map((entry) => entry.index));
  for (let index = FIRST_PATTERN_PALETTE_INDEX; index <= MAX_PALETTE_INDEX; index += 1) {
    if (!used.has(index)) return index;
  }
  return null;
}

export function firstPatternPaletteIndex(palette: ProjectPalette): PaletteIndex | null {
  return palette.entries.find((entry) => entry.type === "pattern")?.index ?? null;
}

export function nextPatternPreviewHue(palette: ProjectPalette): number {
  const patternCount = palette.entries.filter((entry) => entry.type === "pattern").length;
  return PATTERN_PREVIEW_HUES[patternCount % PATTERN_PREVIEW_HUES.length] ?? 210;
}

export function nextDuplicatePatternPreviewHue(palette: ProjectPalette, sourceHue: number): number {
  const usedHues = new Set(
    palette.entries.filter((entry): entry is PatternPaletteEntry => entry.type === "pattern").map((entry) => normalizeHue(entry.previewHue)),
  );
  for (const hue of PATTERN_PREVIEW_HUES) {
    const normalizedHue = normalizeHue(hue);
    if (normalizedHue !== normalizeHue(sourceHue) && !usedHues.has(normalizedHue)) return normalizedHue;
  }
  return normalizeHue(sourceHue + 137);
}

export function normalizedPatternEntry(entry: PatternPaletteEntry): PatternPaletteEntry {
  return {
    ...entry,
    patternId: builtInPattern(entry.patternId) ? entry.patternId : "checker-50",
    offsetX: normalizeInteger(entry.offsetX),
    offsetY: normalizeInteger(entry.offsetY),
    rotation: entry.rotation === 90 || entry.rotation === 180 || entry.rotation === 270 ? entry.rotation : 0,
    reflectX: Boolean(entry.reflectX),
    reflectY: Boolean(entry.reflectY),
    previewHue: normalizeHue(entry.previewHue),
  };
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

  return samplePatternAt(entry.patternId, point, entry) ? BLACK_PIXEL : WHITE_PIXEL;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function normalizeInteger(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function normalizeHue(value: number): number {
  if (!Number.isFinite(value)) return 210;
  return positiveModulo(Math.round(value), 360);
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
