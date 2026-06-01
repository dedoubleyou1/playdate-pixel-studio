import {
  BLACK_PIXEL,
  MAX_PALETTE_INDEX,
  type PaletteIndex,
  type PatternPaletteEntry,
  type PatternSamplingSettings,
  type PixelLayer,
  type ProjectPalette,
} from "./types";
import { DEFAULT_PATTERN_SAMPLING, builtInPattern } from "./patterns";
import {
  nextDuplicatePatternPreviewHue,
  nextPatternPaletteIndex,
  nextPatternPreviewHue,
  normalizedPatternEntry,
  paletteEntryForIndex,
} from "./palette";
import {
  layerStackUsesPaletteIndexes,
  rasterizePaletteIndexesInLayerStack,
  type RasterizationResult,
} from "./rasterization";
import type { EditorSnapshot } from "./types";

export interface PaletteMutationResult {
  palette: ProjectPalette;
  status: string;
  entry?: PatternPaletteEntry;
}

export function createPatternSwatch(
  palette: ProjectPalette,
  patternId: string,
  sampling: PatternSamplingSettings = DEFAULT_PATTERN_SAMPLING,
): PaletteMutationResult | null {
  const index = nextPatternPaletteIndex(palette);
  const pattern = builtInPattern(patternId);
  if (index === null || !pattern) return null;
  const entry = normalizedPatternEntry({
    id: crypto.randomUUID(),
    index,
    name: pattern.name,
    type: "pattern",
    patternId,
    previewHue: nextPatternPreviewHue(palette),
    ...sampling,
  });
  return {
    entry,
    palette: { entries: [...palette.entries, entry] },
    status: `${pattern.name} swatch added`,
  };
}

export function updatePatternSwatch(
  palette: ProjectPalette,
  index: PaletteIndex,
  updates: Partial<Pick<PatternPaletteEntry, "offsetX" | "offsetY" | "patternId" | "reflectX" | "reflectY" | "rotation">>,
): PaletteMutationResult | null {
  const entry = paletteEntryForIndex(palette, index);
  if (entry?.type !== "pattern") return null;
  const pattern = builtInPattern(updates.patternId ?? entry.patternId);
  if (!pattern) return null;
  const updated = normalizedPatternEntry({
    ...entry,
    ...updates,
    name: pattern.name,
    patternId: pattern.id,
  });
  return {
    entry: updated,
    palette: { entries: palette.entries.map((candidate) => (candidate.index === index ? updated : candidate)) },
    status: `${pattern.name} swatch updated`,
  };
}

export function duplicatePatternSwatch(palette: ProjectPalette, index: PaletteIndex): PaletteMutationResult | null {
  const entry = paletteEntryForIndex(palette, index);
  const nextIndex = nextPatternPaletteIndex(palette);
  if (entry?.type !== "pattern" || nextIndex === null) return null;
  const duplicate = normalizedPatternEntry({
    ...entry,
    id: crypto.randomUUID(),
    index: nextIndex,
    previewHue: nextDuplicatePatternPreviewHue(palette, entry.previewHue),
  });
  return {
    entry: duplicate,
    palette: { entries: [...palette.entries, duplicate] },
    status: `${entry.name} swatch duplicated`,
  };
}

export function deletePatternSwatch(snapshot: EditorSnapshot, index: PaletteIndex): RasterizationResult<EditorSnapshot> | null {
  const entry = paletteEntryForIndex(snapshot.palette, index);
  if (entry?.type !== "pattern") return null;
  const targetIndexes = new Set([index]);
  const root = rasterizePaletteIndexesInLayerStack(snapshot.root, snapshot.palette, targetIndexes);
  const objects = snapshot.objects.map((object) => {
    const rasterized = rasterizePaletteIndexesInLayerStack(object, snapshot.palette, targetIndexes);
    return rasterized.changed
      ? { ...object, ...rasterized.value, layers: rasterized.value.layers.filter((layer): layer is PixelLayer => layer.type === "pixel") }
      : object;
  });
  const palette = { entries: snapshot.palette.entries.filter((candidate) => candidate.index !== index) };

  return {
    changed: true,
    value: {
      ...snapshot,
      objects,
      palette,
      root: root.changed ? root.value : snapshot.root,
    },
  };
}

export function snapshotUsesPaletteIndex(snapshot: EditorSnapshot, index: PaletteIndex): boolean {
  const targetIndexes = new Set([index]);
  return (
    layerStackUsesPaletteIndexes(snapshot.root, targetIndexes) ||
    snapshot.objects.some((object) => layerStackUsesPaletteIndexes(object, targetIndexes))
  );
}

export function fallbackActivePaletteIndex(palette: ProjectPalette, deletedIndex: PaletteIndex): PaletteIndex {
  if (palette.entries.some((entry) => entry.index === deletedIndex)) return deletedIndex;
  if (palette.entries.some((entry) => entry.index === BLACK_PIXEL)) return BLACK_PIXEL;
  return palette.entries.find((entry) => entry.index <= MAX_PALETTE_INDEX)?.index ?? BLACK_PIXEL;
}
