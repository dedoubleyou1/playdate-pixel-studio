import type { PatternSamplingSettings, Point } from "./types";

export const PATTERN_LIBRARY_VERSION = 1;

export interface PatternDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  mask: boolean[];
}

export interface PatternLibrarySection {
  id: string;
  title: string;
  patternIds: string[];
}

export const DEFAULT_PATTERN_SAMPLING: PatternSamplingSettings = {
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  reflectX: false,
  reflectY: false,
};

export const BUILT_IN_PATTERNS: PatternDefinition[] = [
  pattern("checker-25", "25%", 2, 2, ["10", "00"]),
  pattern("checker-50", "50%", 2, 2, ["10", "01"]),
  pattern("checker-75", "75%", 2, 2, ["11", "10"]),
  pattern("bayer-25", "Bayer 25%", 4, 4, ["1000", "0001", "0010", "0000"]),
  pattern("bayer-50", "Bayer 50%", 4, 4, ["1001", "0110", "1001", "0110"]),
  pattern("bayer-75", "Bayer 75%", 4, 4, ["1110", "0111", "1011", "1101"]),
  pattern("hatch-vertical", "Vertical Hatch", 4, 4, ["1000", "1000", "1000", "1000"]),
  pattern("hatch-diagonal", "Diagonal Hatch", 4, 4, ["1000", "0100", "0010", "0001"]),
  pattern("crosshatch-light", "Light Crosshatch", 4, 4, ["1000", "0100", "0010", "1001"]),
  pattern("crosshatch-heavy", "Heavy Crosshatch", 4, 4, ["1001", "0110", "0110", "1001"]),
  pattern("dots-sparse", "Sparse Dots", 4, 4, ["1000", "0000", "0010", "0000"]),
  pattern("dots-grid", "Dot Grid", 4, 4, ["1000", "0000", "1000", "0000"]),
  pattern("stipple", "Stipple", 8, 8, ["10000100", "00010000", "01000001", "00001000", "00100000", "00000010", "10010000", "00000100"]),
  pattern("brick", "Brick", 8, 4, ["11111111", "10001000", "11111111", "00100010"]),
  pattern("weave", "Weave", 6, 6, ["110010", "110010", "001101", "001101", "100110", "100110"]),
  pattern("scales", "Scales", 6, 6, ["011110", "100001", "010010", "001100", "000000", "000000"]),
  pattern("stair-step", "Stair Step", 4, 4, ["1000", "1100", "0110", "0011"]),
  pattern("tile", "Tile", 6, 6, ["111111", "100001", "100001", "100001", "100001", "111111"]),
];

export const PATTERN_LIBRARY_SECTIONS: PatternLibrarySection[] = [
  {
    id: "checker-ramps",
    title: "Checker Ramps",
    patternIds: ["checker-25", "checker-50", "checker-75"],
  },
  {
    id: "ordered-dither",
    title: "Ordered Dither",
    patternIds: ["bayer-25", "bayer-50", "bayer-75"],
  },
  {
    id: "hatches",
    title: "Hatches",
    patternIds: ["hatch-vertical", "hatch-diagonal"],
  },
  {
    id: "crosshatches",
    title: "Crosshatches",
    patternIds: ["crosshatch-light", "crosshatch-heavy"],
  },
  {
    id: "dots",
    title: "Dots And Stipple",
    patternIds: ["dots-sparse", "dots-grid", "stipple"],
  },
  {
    id: "textures",
    title: "Texture Tiles",
    patternIds: ["brick", "weave", "scales", "stair-step", "tile"],
  },
];

export function builtInPattern(patternId: string): PatternDefinition | null {
  return BUILT_IN_PATTERNS.find((candidate) => candidate.id === patternId) ?? null;
}

export function patternAt(patternId: string, point: Point): boolean {
  const patternDefinition = builtInPattern(patternId);
  if (!patternDefinition) return false;

  const x = positiveModulo(point.x, patternDefinition.width);
  const y = positiveModulo(point.y, patternDefinition.height);
  return patternDefinition.mask[y * patternDefinition.width + x] ?? false;
}

export function samplePatternAt(
  patternId: string,
  point: Point,
  sampling: PatternSamplingSettings = DEFAULT_PATTERN_SAMPLING,
): boolean {
  return patternAt(patternId, transformPatternPoint(point, sampling));
}

export function transformPatternPoint(point: Point, sampling: PatternSamplingSettings): Point {
  let x = point.x - sampling.offsetX;
  let y = point.y - sampling.offsetY;

  if (sampling.reflectX) x = -x;
  if (sampling.reflectY) y = -y;

  switch (sampling.rotation) {
    case 90:
      return { x: y, y: -x };
    case 180:
      return { x: -x, y: -y };
    case 270:
      return { x: -y, y: x };
    default:
      return { x, y };
  }
}

function pattern(id: string, name: string, width: number, height: number, rows: string[]): PatternDefinition {
  return {
    id,
    name,
    width,
    height,
    mask: rows.join("").split("").map((cell) => cell === "1"),
  };
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
