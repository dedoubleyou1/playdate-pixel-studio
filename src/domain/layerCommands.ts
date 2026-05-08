import { clampLayerIndex, cloneLayer, createLayer, isPixelEditableLayer } from "./layers";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import type { LayerStack, PixelValue } from "./types";

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

export function setActiveLayerOpacity(stack: LayerStack, opacity: number): LayerStackMutation {
  return {
    stack: {
      ...stack,
      layers: stack.layers.map((layer, index) => (index === stack.activeLayerIndex ? { ...layer, opacity } : layer)),
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

export function invertActivePixelLayer(stack: LayerStack): LayerStackMutationResult {
  const layer = stack.layers[stack.activeLayerIndex];
  if (!isPixelEditableLayer(layer)) {
    return { status: "Active layer does not support pixel drawing" };
  }
  if (!layer.surface.data.some((pixel) => pixel === BLACK_PIXEL || pixel === WHITE_PIXEL)) {
    return { status: "Layer has no black or white pixels to invert" };
  }

  const data = new Uint8Array(layer.surface.data.length);
  for (let pixel = 0; pixel < layer.surface.data.length; pixel += 1) {
    data[pixel] =
      layer.surface.data[pixel] === BLACK_PIXEL
        ? WHITE_PIXEL
        : layer.surface.data[pixel] === WHITE_PIXEL
          ? BLACK_PIXEL
          : TRANSPARENT_PIXEL;
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
    status: "Layer inverted",
  };
}

export function hasLayerStackMutation(result: LayerStackMutationResult): result is LayerStackMutation {
  return "stack" in result;
}
