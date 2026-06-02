import {
  BLACK_PIXEL,
  MAX_SWATCH_REF,
  type SwatchRef,
  type PatternPaletteEntry,
  type PatternSamplingSettings,
  type PixelLayer,
  type ProjectPalette,
} from "./types";
import { DEFAULT_PATTERN_SAMPLING, builtInPattern } from "./patterns";
import {
  nextDuplicatePatternPreviewHue,
  nextPatternSwatchRef,
  nextPatternPreviewHue,
  normalizedPatternEntry,
  paletteEntryForRef,
} from "./palette";
import {
  layerStackUsesSwatchRefs,
  rasterizeSwatchRefsInLayerStack,
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
  const ref = nextPatternSwatchRef(palette);
  const pattern = builtInPattern(patternId);
  if (ref === null || !pattern) return null;
  const entry = normalizedPatternEntry({
    id: crypto.randomUUID(),
    ref,
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
  ref: SwatchRef,
  updates: Partial<Pick<PatternPaletteEntry, "offsetX" | "offsetY" | "patternId" | "reflectX" | "reflectY" | "rotation">>,
): PaletteMutationResult | null {
  const entry = paletteEntryForRef(palette, ref);
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
    palette: { entries: palette.entries.map((candidate) => (candidate.ref === ref ? updated : candidate)) },
    status: `${pattern.name} swatch updated`,
  };
}

export function duplicatePatternSwatch(palette: ProjectPalette, ref: SwatchRef): PaletteMutationResult | null {
  const entry = paletteEntryForRef(palette, ref);
  const nextRef = nextPatternSwatchRef(palette);
  if (entry?.type !== "pattern" || nextRef === null) return null;
  const duplicate = normalizedPatternEntry({
    ...entry,
    id: crypto.randomUUID(),
    ref: nextRef,
    previewHue: nextDuplicatePatternPreviewHue(palette, entry.previewHue),
  });
  return {
    entry: duplicate,
    palette: { entries: [...palette.entries, duplicate] },
    status: `${entry.name} swatch duplicated`,
  };
}

export function deletePatternSwatch(snapshot: EditorSnapshot, ref: SwatchRef): RasterizationResult<EditorSnapshot> | null {
  const entry = paletteEntryForRef(snapshot.palette, ref);
  if (entry?.type !== "pattern") return null;
  const targetRefs = new Set([ref]);
  const root = rasterizeSwatchRefsInLayerStack(snapshot.root, snapshot.palette, targetRefs);
  const objects = snapshot.objects.map((object) => {
    const rasterized = rasterizeSwatchRefsInLayerStack(object, snapshot.palette, targetRefs);
    return rasterized.changed
      ? { ...object, ...rasterized.value, layers: rasterized.value.layers.filter((layer): layer is PixelLayer => layer.type === "pixel") }
      : object;
  });
  const palette = { entries: snapshot.palette.entries.filter((candidate) => candidate.ref !== ref) };

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

export function snapshotUsesSwatchRef(snapshot: EditorSnapshot, ref: SwatchRef): boolean {
  const targetRefs = new Set([ref]);
  return (
    layerStackUsesSwatchRefs(snapshot.root, targetRefs) ||
    snapshot.objects.some((object) => layerStackUsesSwatchRefs(object, targetRefs))
  );
}

export function fallbackActiveSwatchRef(palette: ProjectPalette, deletedRef: SwatchRef): SwatchRef {
  if (palette.entries.some((entry) => entry.ref === deletedRef)) return deletedRef;
  const nearest = palette.entries
    .filter((entry) => entry.ref <= MAX_SWATCH_REF)
    .reduce<SwatchRef | null>((closest, entry) => {
      if (closest === null) return entry.ref;
      const entryDistance = Math.abs(entry.ref - deletedRef);
      const closestDistance = Math.abs(closest - deletedRef);
      if (entryDistance < closestDistance) return entry.ref;
      if (entryDistance === closestDistance && entry.ref < closest) return entry.ref;
      return closest;
    }, null);
  return nearest ?? BLACK_PIXEL;
}
