import { cloneSnapshot } from "./layers";
import type { EditContext, EditorSnapshot, Layer, LayerStack, ObjectDefinition, PixelLayer } from "./types";

export interface DocumentCommand {
  id: string;
  label: string;
  before: EditorSnapshot;
  after: EditorSnapshot;
  createdAt: number;
}

export function createDocumentCommand(label: string, before: EditorSnapshot, after: EditorSnapshot): DocumentCommand {
  return {
    id: crypto.randomUUID(),
    label,
    before: cloneSnapshot(before),
    after: cloneSnapshot(after),
    createdAt: Date.now(),
  };
}

export function snapshotsEqual(left: EditorSnapshot, right: EditorSnapshot): boolean {
  if (!editContextsEqual(left.activeContext, right.activeContext)) return false;
  if (!layerStacksEqual(left.root, right.root)) return false;
  if (left.objects.length !== right.objects.length) return false;

  return left.objects.every((object, index) => {
    const other = right.objects[index];
    if (!other) return false;
    return objectDefinitionsEqual(object, other);
  });
}

function objectDefinitionsEqual(left: ObjectDefinition, right: ObjectDefinition): boolean {
  return left.id === right.id && left.name === right.name && layerStacksEqual(left, right);
}

function layerStacksEqual(left: LayerStack, right: LayerStack): boolean {
  if (
    left.width !== right.width ||
    left.height !== right.height ||
    left.background !== right.background ||
    left.nextLayerId !== right.nextLayerId ||
    left.activeLayerIndex !== right.activeLayerIndex ||
    left.layers.length !== right.layers.length
  ) {
    return false;
  }

  return left.layers.every((layer, index) => {
    const other = right.layers[index];
    if (!other) return false;
    return layersEqual(layer, other);
  });
}

function layersEqual(left: Layer, right: Layer): boolean {
  if (
    left.type !== right.type ||
    left.id !== right.id ||
    left.name !== right.name ||
    left.visible !== right.visible ||
    left.locked !== right.locked ||
    left.opacity !== right.opacity
  ) {
    return false;
  }

  if (left.type === "object" && right.type === "object") {
    return left.objectId === right.objectId && left.x === right.x && left.y === right.y;
  }

  if (left.type === "pixel" && right.type === "pixel") {
    return pixelLayersEqual(left, right);
  }

  return false;
}

function pixelLayersEqual(left: PixelLayer, right: PixelLayer): boolean {
  if (
    left.surface.width !== right.surface.width ||
    left.surface.height !== right.surface.height ||
    left.surface.data.length !== right.surface.data.length
  ) {
    return false;
  }

  for (let pixel = 0; pixel < left.surface.data.length; pixel += 1) {
    if (left.surface.data[pixel] !== right.surface.data[pixel]) {
      return false;
    }
  }

  return true;
}

function editContextsEqual(left: EditContext, right: EditContext): boolean {
  if (left.type !== right.type) return false;
  return left.type === "root" || left.objectId === (right as { objectId: string }).objectId;
}
