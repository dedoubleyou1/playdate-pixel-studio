import { cloneSnapshot } from "./layers";
import type { EditorSnapshot } from "./types";

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
  if (left.nextLayerId !== right.nextLayerId || left.activeLayerIndex !== right.activeLayerIndex) return false;
  if (left.layers.length !== right.layers.length) return false;

  return left.layers.every((layer, index) => {
    const other = right.layers[index];
    if (!other) return false;
    if (
      layer.id !== other.id ||
      layer.name !== other.name ||
      layer.visible !== other.visible ||
      layer.locked !== other.locked ||
      layer.opacity !== other.opacity ||
      layer.data.length !== other.data.length
    ) {
      return false;
    }

    for (let pixel = 0; pixel < layer.data.length; pixel += 1) {
      if (layer.data[pixel] !== other.data[pixel]) return false;
    }

    return true;
  });
}
