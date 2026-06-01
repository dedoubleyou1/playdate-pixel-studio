import type { PatternSamplingSettings, Point } from "./types";

export const PATTERN_LIBRARY_VERSION = 6;

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
  bayer2x2Pattern("bayer-2x2-1", "2x2 Bayer 1/4", 1),
  bayer2x2Pattern("bayer-2x2-2", "2x2 Bayer 2/4", 2),
  bayer2x2Pattern("bayer-2x2-3", "2x2 Bayer 3/4", 3),
  bayer4x4Pattern("bayer-4x4-1", "4x4 Bayer 1/16", 1),
  bayer4x4Pattern("bayer-4x4-2", "4x4 Bayer 2/16", 2),
  bayer4x4Pattern("bayer-4x4-3", "4x4 Bayer 3/16", 3),
  bayer4x4Pattern("bayer-4x4-4", "4x4 Bayer 4/16", 4),
  bayer4x4Pattern("bayer-4x4-5", "4x4 Bayer 5/16", 5),
  bayer4x4Pattern("bayer-4x4-6", "4x4 Bayer 6/16", 6),
  bayer4x4Pattern("bayer-4x4-7", "4x4 Bayer 7/16", 7),
  bayer4x4Pattern("bayer-4x4-8", "4x4 Bayer 8/16", 8),
  bayer4x4Pattern("bayer-4x4-9", "4x4 Bayer 9/16", 9),
  bayer4x4Pattern("bayer-4x4-10", "4x4 Bayer 10/16", 10),
  bayer4x4Pattern("bayer-4x4-11", "4x4 Bayer 11/16", 11),
  bayer4x4Pattern("bayer-4x4-12", "4x4 Bayer 12/16", 12),
  bayer4x4Pattern("bayer-4x4-13", "4x4 Bayer 13/16", 13),
  bayer4x4Pattern("bayer-4x4-14", "4x4 Bayer 14/16", 14),
  bayer4x4Pattern("bayer-4x4-15", "4x4 Bayer 15/16", 15),
  verticalHatchPattern("hatch-vertical-1", "Vertical Hatch 1/4", 1),
  verticalHatchPattern("hatch-vertical-2", "Vertical Hatch 2/4", 2),
  verticalHatchPattern("hatch-vertical-3", "Vertical Hatch 3/4", 3),
  diagonalHatchPattern("hatch-diagonal-1", "Diagonal Hatch 1/4", 1),
  diagonalHatchPattern("hatch-diagonal-2", "Diagonal Hatch 2/4", 2),
  diagonalHatchPattern("hatch-diagonal-3", "Diagonal Hatch 3/4", 3),
];

export const PATTERN_LIBRARY_SECTIONS: PatternLibrarySection[] = [
  {
    id: "bayer-2x2",
    title: "2x2 Bayer",
    patternIds: ["bayer-2x2-1", "bayer-2x2-2", "bayer-2x2-3"],
  },
  {
    id: "bayer-4x4",
    title: "4x4 Bayer",
    patternIds: [
      "bayer-4x4-1",
      "bayer-4x4-2",
      "bayer-4x4-3",
      "bayer-4x4-4",
      "bayer-4x4-5",
      "bayer-4x4-6",
      "bayer-4x4-7",
      "bayer-4x4-8",
      "bayer-4x4-9",
      "bayer-4x4-10",
      "bayer-4x4-11",
      "bayer-4x4-12",
      "bayer-4x4-13",
      "bayer-4x4-14",
      "bayer-4x4-15",
    ],
  },
  {
    id: "vertical-hatches",
    title: "Vertical Hatches",
    patternIds: ["hatch-vertical-1", "hatch-vertical-2", "hatch-vertical-3"],
  },
  {
    id: "diagonal-hatches",
    title: "Diagonal Hatches",
    patternIds: ["hatch-diagonal-1", "hatch-diagonal-2", "hatch-diagonal-3"],
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
  const patternDefinition = builtInPattern(patternId);
  if (!patternDefinition) return false;

  const transformed = transformPatternPoint(point, sampling, {
    height: patternDefinition.height,
    width: patternDefinition.width,
  });
  return patternAt(patternId, transformed);
}

export function transformPatternPoint(
  point: Point,
  sampling: PatternSamplingSettings,
  bounds?: { height: number; width: number },
): Point {
  const width = bounds?.width ?? 0;
  const height = bounds?.height ?? 0;
  let x = bounds ? positiveModulo(point.x - sampling.offsetX, width) : point.x - sampling.offsetX;
  let y = bounds ? positiveModulo(point.y - sampling.offsetY, height) : point.y - sampling.offsetY;

  if (sampling.reflectX) x = bounds ? width - 1 - x : -x;
  if (sampling.reflectY) y = bounds ? height - 1 - y : -y;

  switch (sampling.rotation) {
    case 90:
      return bounds ? { x: y, y: width - 1 - x } : { x: y, y: -x };
    case 180:
      return bounds ? { x: width - 1 - x, y: height - 1 - y } : { x: -x, y: -y };
    case 270:
      return bounds ? { x: height - 1 - y, y: x } : { x: -y, y: x };
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

function bayer2x2Pattern(id: string, name: string, filledCells: number): PatternDefinition {
  const order = [
    [0, 2],
    [3, 1],
  ];
  return pattern(
    id,
    name,
    2,
    2,
    order.map((row) => row.map((rank) => (rank < filledCells ? "1" : "0")).join("")),
  );
}

function bayer4x4Pattern(id: string, name: string, filledCells: number): PatternDefinition {
  const order = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  return pattern(
    id,
    name,
    4,
    4,
    order.map((row) => row.map((rank) => (rank < filledCells ? "1" : "0")).join("")),
  );
}

function verticalHatchPattern(id: string, name: string, filledColumns: number): PatternDefinition {
  return pattern(
    id,
    name,
    4,
    4,
    Array.from({ length: 4 }, () => Array.from({ length: 4 }, (_, x) => (x < filledColumns ? "1" : "0")).join("")),
  );
}

function diagonalHatchPattern(id: string, name: string, filledBands: number): PatternDefinition {
  return pattern(
    id,
    name,
    4,
    4,
    Array.from({ length: 4 }, (_, y) =>
      Array.from({ length: 4 }, (_, x) => (positiveModulo(x - y, 4) < filledBands ? "1" : "0")).join(""),
    ),
  );
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
