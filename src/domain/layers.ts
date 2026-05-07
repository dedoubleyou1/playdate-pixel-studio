import { PLAYDATE_PIXELS } from "./constants";
import type { EditorSnapshot, PixelLayer } from "./types";

export function createLayer(id: number, name: string): PixelLayer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    opacity: 100,
    data: new Uint8Array(PLAYDATE_PIXELS),
  };
}

export function cloneLayer(layer: PixelLayer): PixelLayer {
  return {
    ...layer,
    data: new Uint8Array(layer.data),
  };
}

export function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    nextLayerId: snapshot.nextLayerId,
    activeLayerIndex: snapshot.activeLayerIndex,
    layers: snapshot.layers.map(cloneLayer),
  };
}

export function activeLayer(snapshot: EditorSnapshot): PixelLayer {
  return snapshot.layers[snapshot.activeLayerIndex];
}

export function clampLayerIndex(index: number, layerCount: number): number {
  return Math.max(0, Math.min(index, layerCount - 1));
}
