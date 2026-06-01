import { resolvePaletteEntry } from "./palette";
import { TRANSPARENT_PIXEL, type LayerStack, type PaletteIndex, type PixelLayer, type PixelSurface, type ProjectPalette } from "./types";

export interface RasterizationResult<T> {
  changed: boolean;
  value: T;
}

export function rasterizePalettePoint(
  palette: ProjectPalette,
  paletteIndex: PaletteIndex,
  point: { x: number; y: number },
): PaletteIndex {
  return resolvePaletteEntry(palette, paletteIndex, point);
}

export function rasterizePaletteIndexesInSurface(
  surface: PixelSurface,
  palette: ProjectPalette,
  targetIndexes: ReadonlySet<PaletteIndex>,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): RasterizationResult<PixelSurface> {
  let changed = false;
  const data = new Uint8Array(surface.data);

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const index = y * surface.width + x;
      const paletteIndex = data[index];
      if (!targetIndexes.has(paletteIndex)) continue;
      const resolved = rasterizePalettePoint(palette, paletteIndex, { x: x + origin.x, y: y + origin.y });
      if (resolved !== paletteIndex) {
        data[index] = resolved;
        changed = true;
      }
    }
  }

  return changed ? { changed, value: { ...surface, data } } : { changed, value: surface };
}

export function surfaceUsesPaletteIndexes(surface: PixelSurface, targetIndexes: ReadonlySet<PaletteIndex>): boolean {
  return surface.data.some((paletteIndex) => targetIndexes.has(paletteIndex));
}

export function layerStackUsesPaletteIndexes(stack: LayerStack, targetIndexes: ReadonlySet<PaletteIndex>): boolean {
  if (targetIndexes.has(stack.background)) return true;
  return stack.layers.some((layer) => layer.type === "pixel" && surfaceUsesPaletteIndexes(layer.surface, targetIndexes));
}

export function rasterizePaletteIndexesInLayerStack(
  stack: LayerStack,
  palette: ProjectPalette,
  targetIndexes: ReadonlySet<PaletteIndex>,
): RasterizationResult<LayerStack> {
  let changed = false;
  const layers = stack.layers.map((layer) => {
    if (layer.type !== "pixel") return layer;
    const rasterized = rasterizePaletteIndexesInSurface(layer.surface, palette, targetIndexes);
    if (!rasterized.changed) return layer;
    changed = true;
    return {
      ...layer,
      contentRevision: layer.contentRevision + 1,
      surface: rasterized.value,
    };
  });

  if (!targetIndexes.has(stack.background)) {
    return changed ? { changed, value: { ...stack, layers } } : { changed, value: stack };
  }

  changed = true;
  const backgroundLayer = rasterizedBackgroundLayer(stack, palette);
  return {
    changed,
    value: {
      ...stack,
      activeLayerIndex: stack.activeLayerIndex + 1,
      background: TRANSPARENT_PIXEL,
      layers: [backgroundLayer, ...layers],
      nextLayerId: stack.nextLayerId + 1,
    },
  };
}

function rasterizedBackgroundLayer(stack: LayerStack, palette: ProjectPalette): PixelLayer {
  const data = new Uint8Array(stack.width * stack.height);
  for (let y = 0; y < stack.height; y += 1) {
    for (let x = 0; x < stack.width; x += 1) {
      data[y * stack.width + x] = rasterizePalettePoint(palette, stack.background, { x, y });
    }
  }

  return {
    type: "pixel",
    id: stack.nextLayerId,
    name: "Rasterized background",
    visible: true,
    pixelEditable: true,
    contentRevision: 0,
    surface: {
      width: stack.width,
      height: stack.height,
      data,
    },
  };
}
