import {
  BLACK_PIXEL,
  MAX_SWATCH_REF,
  TRANSPARENT_PIXEL,
  WHITE_PIXEL,
  type PaletteEntry,
  type SwatchRef,
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

export const FIRST_PATTERN_SWATCH_REF = 3;
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
      { id: "alpha", ref: TRANSPARENT_PIXEL, name: "Transparent", type: "solid", value: "alpha" },
      { id: "black", ref: BLACK_PIXEL, name: "Black", type: "solid", value: "black" },
      { id: "white", ref: WHITE_PIXEL, name: "White", type: "solid", value: "white" },
      {
        id: "bayer-2x2-1",
        ref: 3,
        name: "2x2 Bayer 1/4",
        type: "pattern",
        patternId: "bayer-2x2-1",
        previewHue: 210,
        ...DEFAULT_PATTERN_SAMPLING,
      },
      {
        id: "bayer-2x2-2",
        ref: 4,
        name: "2x2 Bayer 2/4",
        type: "pattern",
        patternId: "bayer-2x2-2",
        previewHue: 300,
        ...DEFAULT_PATTERN_SAMPLING,
      },
      {
        id: "bayer-2x2-3",
        ref: 5,
        name: "2x2 Bayer 3/4",
        type: "pattern",
        patternId: "bayer-2x2-3",
        previewHue: 120,
        ...DEFAULT_PATTERN_SAMPLING,
      },
    ],
  };
}

export function normalizeSwatchRef(value: number): SwatchRef {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SWATCH_REF) return TRANSPARENT_PIXEL;
  return value;
}

export function paletteEntryForRef(palette: ProjectPalette, ref: SwatchRef): PaletteEntry | null {
  return palette.entries.find((entry) => entry.ref === ref) ?? null;
}

export function paletteEntryLabel(palette: ProjectPalette, ref: SwatchRef): string {
  return paletteEntryForRef(palette, ref)?.name ?? "Transparent";
}

export function swatchRefForNumberShortcut(palette: ProjectPalette, key: string): SwatchRef | null {
  if (!/^[0-9]$/.test(key)) return null;
  return swatchShortcutRefs(palette)[Number(key)] ?? null;
}

export function numberShortcutForSwatchRef(palette: ProjectPalette, ref: SwatchRef): string | null {
  const shortcutIndex = swatchShortcutRefs(palette).findIndex((candidate) => candidate === ref);
  return shortcutIndex >= 0 && shortcutIndex <= 9 ? String(shortcutIndex) : null;
}

export function projectPaletteKey(palette: ProjectPalette): string {
  return palette.entries
    .map((entry) =>
      entry.type === "solid"
        ? `${entry.ref}:${entry.id}:${entry.type}:${entry.value}`
        : `${entry.ref}:${entry.id}:${entry.type}:${entry.patternId}:${patternSamplingKey(entry)}:${entry.previewHue}`,
    )
    .join("|")
    .concat(`:patterns-v${PATTERN_LIBRARY_VERSION}`);
}

export function resolveSwatchAtSamplePoint(
  palette: ProjectPalette,
  ref: SwatchRef,
  samplePoint: Point,
): typeof TRANSPARENT_PIXEL | typeof BLACK_PIXEL | typeof WHITE_PIXEL {
  return resolveSwatchRef(palette, normalizeSwatchRef(ref), samplePoint, new Set());
}

export function resolveSwatchPreviewColorAtSamplePoint(
  palette: ProjectPalette,
  ref: SwatchRef,
  samplePoint: Point,
  options: PalettePreviewOptions = {},
): PalettePreviewColor | null {
  const swatchRef = normalizeSwatchRef(ref);
  const entry = paletteEntryForRef(palette, swatchRef);
  const pixel = resolveSwatchRef(palette, swatchRef, samplePoint, new Set());

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

export function solidPaletteValueToRef(
  value: SolidPaletteValue,
): typeof TRANSPARENT_PIXEL | typeof BLACK_PIXEL | typeof WHITE_PIXEL {
  if (value === "black") return BLACK_PIXEL;
  if (value === "white") return WHITE_PIXEL;
  return TRANSPARENT_PIXEL;
}

export function patternSamplingKey(entry: PatternPaletteEntry): string {
  return `${entry.offsetX},${entry.offsetY},${entry.rotation},${entry.reflectX ? 1 : 0},${entry.reflectY ? 1 : 0}`;
}

export function nextPatternSwatchRef(palette: ProjectPalette): SwatchRef | null {
  const used = new Set(palette.entries.map((entry) => entry.ref));
  for (let ref = FIRST_PATTERN_SWATCH_REF; ref <= MAX_SWATCH_REF; ref += 1) {
    if (!used.has(ref)) return ref;
  }
  return null;
}

function swatchShortcutRefs(palette: ProjectPalette): SwatchRef[] {
  const fixedEntries = [
    palette.entries.find((entry) => entry.type === "solid" && entry.value === "alpha"),
    palette.entries.find((entry) => entry.type === "solid" && entry.value === "black"),
    palette.entries.find((entry) => entry.type === "solid" && entry.value === "white"),
  ].filter((entry): entry is PaletteEntry => Boolean(entry));
  const fixedRefs = new Set(fixedEntries.map((entry) => entry.ref));
  return [...fixedEntries.map((entry) => entry.ref), ...palette.entries.filter((entry) => !fixedRefs.has(entry.ref)).map((entry) => entry.ref)];
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
    patternId: builtInPattern(entry.patternId) ? entry.patternId : "bayer-2x2-2",
    offsetX: normalizeInteger(entry.offsetX),
    offsetY: normalizeInteger(entry.offsetY),
    rotation: entry.rotation === 90 || entry.rotation === 180 || entry.rotation === 270 ? entry.rotation : 0,
    reflectX: Boolean(entry.reflectX),
    reflectY: Boolean(entry.reflectY),
    previewHue: normalizeHue(entry.previewHue),
  };
}

function resolveSwatchRef(
  palette: ProjectPalette,
  ref: SwatchRef,
  samplePoint: Point,
  seen: Set<SwatchRef>,
): typeof TRANSPARENT_PIXEL | typeof BLACK_PIXEL | typeof WHITE_PIXEL {
  if (seen.has(ref)) return TRANSPARENT_PIXEL;
  seen.add(ref);

  const entry = paletteEntryForRef(palette, ref);
  if (!entry) return TRANSPARENT_PIXEL;
  if (entry.type === "solid") return solidPaletteValueToRef(entry.value);

  return samplePatternAt(entry.patternId, samplePoint, entry) ? BLACK_PIXEL : WHITE_PIXEL;
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
