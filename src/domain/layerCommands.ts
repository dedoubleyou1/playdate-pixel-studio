import { clampLayerIndex, cloneLayer, createLayer, isPixelEditableLayer } from "./layers";
import { translateBinaryMaskSurface } from "./masks";
import { rasterizeSwatchRefsInSurface, surfaceUsesSwatchRefs } from "./rasterization";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import type { Layer, LayerStack, PixelLayer, PixelValue, ProjectPalette, SwatchRef } from "./types";

export interface LayerStackMutation {
  stack: LayerStack;
  status?: string;
}

export interface LayerStackNoop {
  status?: string;
}

export type LayerStackMutationResult = LayerStackMutation | LayerStackNoop;

export function addPixelLayer(stack: LayerStack): LayerStackMutation {
  const layer = createLayer(stack.nextLayerId, `Layer ${stack.layers.length + 1}`, stack.width, stack.height);
  const layers = [...stack.layers];
  layers.splice(stack.activeLayerIndex + 1, 0, layer);

  return {
    stack: {
      ...stack,
      activeLayerIndex: stack.activeLayerIndex + 1,
      layers,
      nextLayerId: stack.nextLayerId + 1,
    },
    status: "Layer added",
  };
}

export function duplicateActiveLayer(stack: LayerStack): LayerStackMutation {
  const source = stack.layers[stack.activeLayerIndex];
  const layer = cloneLayer(source);
  layer.id = stack.nextLayerId;
  layer.name = `${source.name} copy`;
  const layers = [...stack.layers];
  layers.splice(stack.activeLayerIndex + 1, 0, layer);

  return {
    stack: {
      ...stack,
      activeLayerIndex: stack.activeLayerIndex + 1,
      layers,
      nextLayerId: stack.nextLayerId + 1,
    },
    status: "Layer duplicated",
  };
}

export function deleteActiveLayer(stack: LayerStack): LayerStackMutationResult {
  if (stack.layers.length <= 1) return {};
  const layers = stack.layers.filter((_, index) => index !== stack.activeLayerIndex);

  return {
    stack: {
      ...stack,
      activeLayerIndex: clampLayerIndex(stack.activeLayerIndex, layers.length),
      layers,
    },
    status: "Layer deleted",
  };
}

export function moveActiveLayer(stack: LayerStack, direction: -1 | 1): LayerStackMutationResult {
  const target = stack.activeLayerIndex + direction;
  if (target < 0 || target >= stack.layers.length) return {};

  const layers = [...stack.layers];
  const [layer] = layers.splice(stack.activeLayerIndex, 1);
  layers.splice(target, 0, layer);

  return {
    stack: {
      ...stack,
      activeLayerIndex: target,
      layers,
    },
    status: direction > 0 ? "Layer moved up" : "Layer moved down",
  };
}

export function reorderLayer(stack: LayerStack, fromIndex: number, toIndex: number): LayerStackMutationResult {
  if (fromIndex === toIndex) return {};
  if (fromIndex < 0 || fromIndex >= stack.layers.length) return {};
  if (toIndex < 0 || toIndex >= stack.layers.length) return {};

  const activeLayer = stack.layers[stack.activeLayerIndex];
  const layers = [...stack.layers];
  const [layer] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, layer);

  return {
    stack: {
      ...stack,
      activeLayerIndex: layers.findIndex((candidate) => candidate.id === activeLayer.id),
      layers,
    },
    status: "Layer reordered",
  };
}

export function translateLayer(layer: Layer, dx: number, dy: number): Layer {
  if (layer.type === "object") {
    return { ...layer, x: layer.x + dx, y: layer.y + dy };
  }

  return translatePixelLayer(layer, dx, dy);
}

export function translateActiveLayerFrom(
  stack: LayerStack,
  sourceLayer: Layer,
  layerIndex: number,
  dx: number,
  dy: number,
): LayerStackMutationResult {
  if (layerIndex < 0 || layerIndex >= stack.layers.length) return { status: "Layer was not found" };

  return {
    stack: {
      ...stack,
      layers: stack.layers.map((layer, index) => (index === layerIndex ? translateLayer(sourceLayer, dx, dy) : layer)),
    },
    status: "Layer moved",
  };
}

export function setActiveLayerName(stack: LayerStack, index: number, name: string): LayerStackMutation {
  return {
    stack: {
      ...stack,
      layers: stack.layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, name } : layer)),
    },
  };
}

export function setLayerVisibility(stack: LayerStack, index: number, visible: boolean): LayerStackMutation {
  return {
    stack: {
      ...stack,
      layers: stack.layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, visible } : layer)),
    },
  };
}

export function setStackBackgroundColor(stack: LayerStack, background: PixelValue): LayerStackMutationResult {
  if (stack.background === background) return {};

  return {
    stack: {
      ...stack,
      background,
    },
  };
}

export function clearActivePixelLayer(stack: LayerStack): LayerStackMutationResult {
  const layer = stack.layers[stack.activeLayerIndex];
  if (!isPixelEditableLayer(layer)) {
    return { status: "Active layer does not support pixel drawing" };
  }
  if (!layer.surface.data.some((pixel) => pixel !== TRANSPARENT_PIXEL)) {
    return { status: "Layer is already clear" };
  }

  return {
    stack: {
      ...stack,
      layers: stack.layers.map((candidate, index) =>
        index === stack.activeLayerIndex
          ? {
              ...layer,
              contentRevision: layer.contentRevision + 1,
              surface: { ...layer.surface, data: new Uint8Array(layer.surface.data.length) },
            }
          : candidate,
      ),
    },
    status: "Layer cleared",
  };
}

export function activePixelLayerUsesPatternSwatches(stack: LayerStack, palette: ProjectPalette): boolean {
  const layer = stack.layers[stack.activeLayerIndex];
  if (!isPixelEditableLayer(layer)) return false;
  const patternRefs = patternSwatchRefs(palette);
  return patternRefs.size > 0 && surfaceUsesSwatchRefs(layer.surface, patternRefs);
}

export function invertActivePixelLayer(stack: LayerStack, palette?: ProjectPalette): LayerStackMutationResult {
  const layer = stack.layers[stack.activeLayerIndex];
  if (!isPixelEditableLayer(layer)) {
    return { status: "Active layer does not support pixel drawing" };
  }
  const patternRefs = palette ? patternSwatchRefs(palette) : new Set<SwatchRef>();
  const rasterized = palette
    ? rasterizeSwatchRefsInSurface(layer.surface, palette, patternRefs)
    : { changed: false, value: layer.surface };
  if (!rasterized.value.data.some((pixel) => pixel === BLACK_PIXEL || pixel === WHITE_PIXEL)) {
    return { status: "Layer has no black or white pixels to invert" };
  }

  const data = new Uint8Array(rasterized.value.data);
  for (let pixel = 0; pixel < rasterized.value.data.length; pixel += 1) {
    data[pixel] =
      rasterized.value.data[pixel] === BLACK_PIXEL
        ? WHITE_PIXEL
        : rasterized.value.data[pixel] === WHITE_PIXEL
          ? BLACK_PIXEL
          : rasterized.value.data[pixel];
  }

  return {
    stack: {
      ...stack,
      layers: stack.layers.map((candidate, index) =>
        index === stack.activeLayerIndex
          ? { ...layer, contentRevision: layer.contentRevision + 1, surface: { ...layer.surface, data } }
          : candidate,
      ),
    },
    status: rasterized.changed ? "Pattern swatches rasterized and layer inverted" : "Layer inverted",
  };
}

export function hasLayerStackMutation(result: LayerStackMutationResult): result is LayerStackMutation {
  return "stack" in result;
}

function translatePixelLayer(layer: PixelLayer, dx: number, dy: number): PixelLayer {
  if (dx === 0 && dy === 0) {
    return cloneLayer(layer) as PixelLayer;
  }

  const { height, width } = layer.surface;
  const data = new Uint8Array(layer.surface.data.length);

  for (let y = 0; y < height; y += 1) {
    const targetY = y + dy;
    if (targetY < 0 || targetY >= height) continue;

    for (let x = 0; x < width; x += 1) {
      const targetX = x + dx;
      if (targetX < 0 || targetX >= width) continue;

      data[targetY * width + targetX] = layer.surface.data[y * width + x];
    }
  }

  return {
    ...layer,
    alphaMask: layer.alphaMask ? translateBinaryMaskSurface(layer.alphaMask, dx, dy) : undefined,
    surface: {
      ...layer.surface,
      data,
    },
  };
}

function patternSwatchRefs(palette: ProjectPalette): ReadonlySet<SwatchRef> {
  return new Set(palette.entries.filter((entry) => entry.type === "pattern").map((entry) => entry.ref));
}
