import { createSurface } from "./layers";
import { resolveSwatchAtSamplePoint } from "./palette";
import {
  BLACK_PIXEL,
  TRANSPARENT_PIXEL,
  WHITE_PIXEL,
  type PixelSurface,
  type ProjectPalette,
  type SwatchRef,
} from "./types";

export const IMAGE_IMPORT_ALPHA_THRESHOLD = 128;
export const IMAGE_IMPORT_EXACT_COLOR_LIMIT = 128;
export const IMAGE_IMPORT_SEGMENT_LIMIT = 48;
export const IMAGE_IMPORT_MAX_OBJECT_DIMENSION = 400;

export type ImageImportMode = "exact" | "segment";
export type ImageImportEntryKind = "transparent" | "exact" | "segment";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface DecodedImportImage {
  fileName: string;
  height: number;
  mimeType: string;
  pixels: Uint8ClampedArray;
  width: number;
}

export interface ImageImportMappingEntry {
  id: string;
  kind: ImageImportEntryKind;
  luminance: number;
  pixelCount: number;
  representativeColor: RgbColor | null;
}

export interface PreparedImageImport {
  entries: ImageImportMappingEntry[];
  entryIndexByPixel: Uint16Array;
  height: number;
  mode: ImageImportMode;
  width: number;
}

export type ImageImportMapping = Record<string, SwatchRef>;

export interface ImageImportRejection {
  reason: "too-large" | "too-many-colors" | "empty";
  colorCount?: number;
  height?: number;
  limit?: number;
  width?: number;
}

export type ExactImageImportResult =
  | { ok: true; import: PreparedImageImport }
  | { ok: false; rejection: ImageImportRejection };

interface ExactColorRecord {
  id: string;
  kind: "exact";
  key: string;
  luminance: number;
  pixelCount: number;
  representativeColor: RgbColor;
}

interface SegmentAccumulator {
  b: number;
  g: number;
  key: string;
  pixelCount: number;
  r: number;
}

export function prepareExactImageImport(
  image: DecodedImportImage,
  options: { alphaThreshold?: number; maxColors?: number; maxDimension?: number } = {},
): ExactImageImportResult {
  const alphaThreshold = options.alphaThreshold ?? IMAGE_IMPORT_ALPHA_THRESHOLD;
  const maxColors = options.maxColors ?? IMAGE_IMPORT_EXACT_COLOR_LIMIT;
  const maxDimension = options.maxDimension ?? IMAGE_IMPORT_MAX_OBJECT_DIMENSION;

  if (image.width > maxDimension || image.height > maxDimension) {
    return {
      ok: false,
      rejection: { reason: "too-large", width: image.width, height: image.height, limit: maxDimension },
    };
  }

  const transparentIndex = 0;
  const entries: Array<ImageImportMappingEntry | ExactColorRecord> = [
    {
      id: "transparent",
      kind: "transparent",
      luminance: -1,
      pixelCount: 0,
      representativeColor: null,
    },
  ];
  const entryIndexByPixel = new Uint16Array(image.width * image.height);
  const exactColorIndexes = new Map<string, number>();
  let tooManyColors = false;

  forEachImagePixel(image, (pixelIndex, red, green, blue, alpha) => {
    if (alpha < alphaThreshold) {
      entries[transparentIndex].pixelCount += 1;
      entryIndexByPixel[pixelIndex] = transparentIndex;
      return;
    }

    const key = rgbKey(red, green, blue);
    let entryIndex = exactColorIndexes.get(key);
    if (entryIndex === undefined) {
      if (exactColorIndexes.size >= maxColors) {
        tooManyColors = true;
        return;
      }
      entryIndex = entries.length;
      exactColorIndexes.set(key, entryIndex);
      entries.push({
        id: `exact:${key}`,
        kind: "exact",
        key,
        luminance: luminance({ r: red, g: green, b: blue }),
        pixelCount: 0,
        representativeColor: { r: red, g: green, b: blue },
      });
    }
    entries[entryIndex].pixelCount += 1;
    entryIndexByPixel[pixelIndex] = entryIndex;
  });

  if (tooManyColors) {
    return {
      ok: false,
      rejection: { reason: "too-many-colors", colorCount: maxColors + 1, limit: maxColors },
    };
  }

  if (exactColorIndexes.size === 0 && entries[transparentIndex].pixelCount === 0) {
    return { ok: false, rejection: { reason: "empty" } };
  }

  return {
    ok: true,
    import: sortedPreparedImport({
      entries,
      entryIndexByPixel,
      height: image.height,
      mode: "exact",
      width: image.width,
    }),
  };
}

export function prepareSegmentedImageImport(
  image: DecodedImportImage,
  options: { alphaThreshold?: number; maxDimension?: number; maxSegments?: number } = {},
): PreparedImageImport {
  const alphaThreshold = options.alphaThreshold ?? IMAGE_IMPORT_ALPHA_THRESHOLD;
  const maxDimension = options.maxDimension ?? IMAGE_IMPORT_MAX_OBJECT_DIMENSION;
  const maxSegments = options.maxSegments ?? IMAGE_IMPORT_SEGMENT_LIMIT;
  const scaled = downscaleImageNearest(image, maxDimension);

  for (let shift = 0; shift <= 8; shift += 1) {
    const grouped = groupImageByColorCells(scaled, alphaThreshold, shift);
    if (grouped.opaqueGroups.size <= maxSegments || shift === 8) {
      return segmentedImportFromGroups(scaled, grouped, shift, alphaThreshold);
    }
  }

  throw new Error("Unable to segment image import.");
}

export function downscaleImageNearest(image: DecodedImportImage, maxDimension: number): DecodedImportImage {
  const scale = Math.min(1, maxDimension / image.width, maxDimension / image.height);
  if (scale >= 1) return image;

  const width = Math.max(1, Math.floor(image.width * scale));
  const height = Math.max(1, Math.floor(image.height * scale));
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(x / scale));
      const sourceOffset = (sourceY * image.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      pixels[targetOffset] = image.pixels[sourceOffset];
      pixels[targetOffset + 1] = image.pixels[sourceOffset + 1];
      pixels[targetOffset + 2] = image.pixels[sourceOffset + 2];
      pixels[targetOffset + 3] = image.pixels[sourceOffset + 3];
    }
  }

  return {
    ...image,
    height,
    pixels,
    width,
  };
}

export function createDefaultImageImportMapping(
  prepared: PreparedImageImport,
  palette: ProjectPalette,
): ImageImportMapping {
  const mapping: ImageImportMapping = {};
  const opaqueEntries = prepared.entries.filter((entry) => entry.kind !== "transparent").sort(compareImportEntries);
  const targetRamp = swatchRamp(palette);

  for (const entry of prepared.entries) {
    if (entry.kind === "transparent") {
      mapping[entry.id] = TRANSPARENT_PIXEL;
    }
  }

  if (targetRamp.length === 0) {
    for (const entry of opaqueEntries) mapping[entry.id] = BLACK_PIXEL;
    return mapping;
  }

  for (const [index, entry] of opaqueEntries.entries()) {
    const rampIndex =
      opaqueEntries.length <= 1 ? 0 : Math.round((index / (opaqueEntries.length - 1)) * (targetRamp.length - 1));
    mapping[entry.id] = targetRamp[rampIndex] ?? BLACK_PIXEL;
  }

  return mapping;
}

export function createMappedImageImportSurface(
  prepared: PreparedImageImport,
  mapping: ImageImportMapping,
): PixelSurface {
  const surface = createSurface(prepared.width, prepared.height);

  for (let index = 0; index < prepared.entryIndexByPixel.length; index += 1) {
    const entry = prepared.entries[prepared.entryIndexByPixel[index]];
    surface.data[index] = entry ? (mapping[entry.id] ?? TRANSPARENT_PIXEL) : TRANSPARENT_PIXEL;
  }

  return surface;
}

function groupImageByColorCells(
  image: DecodedImportImage,
  alphaThreshold: number,
  shift: number,
): {
  opaqueGroups: Map<string, SegmentAccumulator>;
  transparentCount: number;
} {
  const opaqueGroups = new Map<string, SegmentAccumulator>();
  let transparentCount = 0;

  forEachImagePixel(image, (_pixelIndex, red, green, blue, alpha) => {
    if (alpha < alphaThreshold) {
      transparentCount += 1;
      return;
    }

    const key = colorCellKey(red, green, blue, shift);
    const group = opaqueGroups.get(key);
    if (group) {
      group.r += red;
      group.g += green;
      group.b += blue;
      group.pixelCount += 1;
    } else {
      opaqueGroups.set(key, {
        key,
        r: red,
        g: green,
        b: blue,
        pixelCount: 1,
      });
    }
  });

  return { opaqueGroups, transparentCount };
}

function segmentedImportFromGroups(
  image: DecodedImportImage,
  grouped: ReturnType<typeof groupImageByColorCells>,
  shift: number,
  alphaThreshold: number,
): PreparedImageImport {
  const entries: ImageImportMappingEntry[] = [
    {
      id: "transparent",
      kind: "transparent",
      luminance: -1,
      pixelCount: grouped.transparentCount,
      representativeColor: null,
    },
  ];
  const groupIndexes = new Map<string, number>();
  const entryIndexByPixel = new Uint16Array(image.width * image.height);

  for (const group of grouped.opaqueGroups.values()) {
    const representativeColor = {
      r: Math.round(group.r / group.pixelCount),
      g: Math.round(group.g / group.pixelCount),
      b: Math.round(group.b / group.pixelCount),
    };
    const entryIndex = entries.length;
    groupIndexes.set(group.key, entryIndex);
    entries.push({
      id: `segment:${group.key}`,
      kind: "segment",
      luminance: luminance(representativeColor),
      pixelCount: group.pixelCount,
      representativeColor,
    });
  }

  forEachImagePixel(image, (pixelIndex, red, green, blue, alpha) => {
    if (alpha < alphaThreshold) {
      entryIndexByPixel[pixelIndex] = 0;
      return;
    }
    entryIndexByPixel[pixelIndex] = groupIndexes.get(colorCellKey(red, green, blue, shift)) ?? 0;
  });

  return sortedPreparedImport({
    entries,
    entryIndexByPixel,
    height: image.height,
    mode: "segment",
    width: image.width,
  });
}

function sortedPreparedImport(prepared: PreparedImageImport): PreparedImageImport {
  const indexedEntries = prepared.entries.map((entry, index) => ({ entry, index }));
  indexedEntries.sort((left, right) => {
    if (left.entry.kind === "transparent") return -1;
    if (right.entry.kind === "transparent") return 1;
    return compareImportEntries(left.entry, right.entry);
  });

  const nextIndexForPreviousIndex = new Map<number, number>();
  const entries = indexedEntries.map(({ entry, index }, nextIndex) => {
    nextIndexForPreviousIndex.set(index, nextIndex);
    return entry;
  });
  const entryIndexByPixel = new Uint16Array(prepared.entryIndexByPixel.length);
  for (let index = 0; index < prepared.entryIndexByPixel.length; index += 1) {
    entryIndexByPixel[index] = nextIndexForPreviousIndex.get(prepared.entryIndexByPixel[index]) ?? 0;
  }

  return {
    ...prepared,
    entries,
    entryIndexByPixel,
  };
}

function swatchRamp(palette: ProjectPalette): SwatchRef[] {
  return palette.entries
    .filter((entry) => entry.ref !== TRANSPARENT_PIXEL)
    .map((entry) => ({ ref: entry.ref, darkness: estimateSwatchDarkness(palette, entry.ref) }))
    .sort((left, right) => {
      if (right.darkness !== left.darkness) return right.darkness - left.darkness;
      return left.ref - right.ref;
    })
    .map((entry) => entry.ref);
}

function estimateSwatchDarkness(palette: ProjectPalette, ref: SwatchRef): number {
  if (ref === BLACK_PIXEL) return 1;
  if (ref === WHITE_PIXEL) return 0;

  let black = 0;
  let visible = 0;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const pixel = resolveSwatchAtSamplePoint(palette, ref, { x, y });
      if (pixel === TRANSPARENT_PIXEL) continue;
      visible += 1;
      if (pixel === BLACK_PIXEL) black += 1;
    }
  }
  return visible === 0 ? 0 : black / visible;
}

function compareImportEntries(left: ImageImportMappingEntry, right: ImageImportMappingEntry): number {
  if (left.luminance !== right.luminance) return left.luminance - right.luminance;
  if (right.pixelCount !== left.pixelCount) return right.pixelCount - left.pixelCount;
  return left.id.localeCompare(right.id);
}

function forEachImagePixel(
  image: DecodedImportImage,
  callback: (pixelIndex: number, red: number, green: number, blue: number, alpha: number) => void,
): void {
  for (let pixelIndex = 0; pixelIndex < image.width * image.height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    callback(
      pixelIndex,
      image.pixels[offset],
      image.pixels[offset + 1],
      image.pixels[offset + 2],
      image.pixels[offset + 3],
    );
  }
}

function rgbKey(red: number, green: number, blue: number): string {
  return `${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function colorCellKey(red: number, green: number, blue: number, shift: number): string {
  return `${red >> shift}:${green >> shift}:${blue >> shift}`;
}

function luminance(color: RgbColor): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}
