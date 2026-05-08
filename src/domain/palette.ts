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
  width: number;
  height: number;
  mask: boolean[];
}

export const BUILT_IN_DITHER_PATTERNS: DitherPattern[] = [
  {
    id: "checker-25",
    name: "25%",
    width: 2,
    height: 2,
    mask: [true, false, false, false],
  },
  {
    id: "checker-50",
    name: "50%",
    width: 2,
    height: 2,
    mask: [true, false, false, true],
  },
  {
    id: "checker-75",
    name: "75%",
    width: 2,
    height: 2,
    mask: [true, true, true, false],
  },
];

export function defaultProjectPalette(): ProjectPalette {
  return {
    entries: [
      { id: "alpha", index: TRANSPARENT_PIXEL, name: "Alpha", type: "solid", value: "alpha" },
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
  return paletteEntryForIndex(palette, index)?.name ?? "Alpha";
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
