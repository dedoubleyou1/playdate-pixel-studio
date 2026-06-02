import { resolveSwatchAtSamplePoint } from "./palette";
import { TRANSPARENT_PIXEL, type LayerStack, type SwatchRef, type PixelLayer, type PixelSurface, type ProjectPalette } from "./types";

export interface RasterizationResult<T> {
  changed: boolean;
  value: T;
}

export function rasterizeSwatchAtSamplePoint(
  palette: ProjectPalette,
  swatchRef: SwatchRef,
  samplePoint: { x: number; y: number },
): SwatchRef {
  return resolveSwatchAtSamplePoint(palette, swatchRef, samplePoint);
}

export function rasterizeSwatchRefsInSurfaceAtOrigin(
  surface: PixelSurface,
  palette: ProjectPalette,
  targetRefs: ReadonlySet<SwatchRef>,
  sampleOrigin: { x: number; y: number } = { x: 0, y: 0 },
): RasterizationResult<PixelSurface> {
  let changed = false;
  const data = new Uint8Array(surface.data);

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const index = y * surface.width + x;
      const swatchRef = data[index];
      if (!targetRefs.has(swatchRef)) continue;
      const resolved = rasterizeSwatchAtSamplePoint(palette, swatchRef, { x: x + sampleOrigin.x, y: y + sampleOrigin.y });
      if (resolved !== swatchRef) {
        data[index] = resolved;
        changed = true;
      }
    }
  }

  return changed ? { changed, value: { ...surface, data } } : { changed, value: surface };
}

export function surfaceUsesSwatchRefs(surface: PixelSurface, targetRefs: ReadonlySet<SwatchRef>): boolean {
  return surface.data.some((swatchRef) => targetRefs.has(swatchRef));
}

export function layerStackUsesSwatchRefs(stack: LayerStack, targetRefs: ReadonlySet<SwatchRef>): boolean {
  if (targetRefs.has(stack.background)) return true;
  return stack.layers.some((layer) => layer.type === "pixel" && surfaceUsesSwatchRefs(layer.surface, targetRefs));
}

export function rasterizeSwatchRefsInLayerStack(
  stack: LayerStack,
  palette: ProjectPalette,
  targetRefs: ReadonlySet<SwatchRef>,
): RasterizationResult<LayerStack> {
  let changed = false;
  const layers = stack.layers.map((layer) => {
    if (layer.type !== "pixel") return layer;
    const rasterized = rasterizeSwatchRefsInSurfaceAtOrigin(layer.surface, palette, targetRefs);
    if (!rasterized.changed) return layer;
    changed = true;
    return {
      ...layer,
      contentRevision: layer.contentRevision + 1,
      surface: rasterized.value,
    };
  });

  if (!targetRefs.has(stack.background)) {
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
      data[y * stack.width + x] = rasterizeSwatchAtSamplePoint(palette, stack.background, { x, y });
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
