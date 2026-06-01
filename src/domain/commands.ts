import { cloneSnapshot } from "./layers";
import { cloneSelectionState } from "./masks";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  PaletteEntry,
  PixelLayer,
  SelectionState,
} from "./types";

export interface CommandSelectionSnapshot {
  objectSelection: SelectionState | null;
  rootSelection: SelectionState | null;
}

export interface EditorCommand {
  id: string;
  label: string;
  before: EditorSnapshot;
  after: EditorSnapshot;
  beforeSelection: CommandSelectionSnapshot;
  afterSelection: CommandSelectionSnapshot;
  createdAt: number;
}

export function createEditorCommand(
  label: string,
  before: EditorSnapshot,
  after: EditorSnapshot,
  selection: { afterSelection: CommandSelectionSnapshot; beforeSelection: CommandSelectionSnapshot },
): EditorCommand {
  return {
    id: crypto.randomUUID(),
    label,
    before: cloneSnapshot(before),
    after: cloneSnapshot(after),
    beforeSelection: cloneCommandSelectionSnapshot(selection.beforeSelection),
    afterSelection: cloneCommandSelectionSnapshot(selection.afterSelection),
    createdAt: Date.now(),
  };
}

export function cloneCommandSelectionSnapshot(selection: CommandSelectionSnapshot): CommandSelectionSnapshot {
  return {
    objectSelection: cloneSelectionState(selection.objectSelection),
    rootSelection: cloneSelectionState(selection.rootSelection),
  };
}

export function snapshotsEqual(left: EditorSnapshot, right: EditorSnapshot): boolean {
  if (!editContextsEqual(left.activeContext, right.activeContext)) return false;
  if (!palettesEqual(left.palette, right.palette)) return false;
  if (!layerStacksEqual(left.root, right.root)) return false;
  if (left.objects.length !== right.objects.length) return false;

  return left.objects.every((object, index) => {
    const other = right.objects[index];
    if (!other) return false;
    return objectDefinitionsEqual(object, other);
  });
}

export function commandSelectionSnapshotsEqual(
  left: CommandSelectionSnapshot,
  right: CommandSelectionSnapshot,
): boolean {
  return selectionStatesEqual(left.rootSelection, right.rootSelection) && selectionStatesEqual(left.objectSelection, right.objectSelection);
}

export function editorCommandChangesDocument(command: Pick<EditorCommand, "after" | "before">): boolean {
  return !snapshotsEqual(command.before, command.after);
}

export function editorCommandHasChanges(command: EditorCommand): boolean {
  return editorCommandChangesDocument(command) || !commandSelectionSnapshotsEqual(command.beforeSelection, command.afterSelection);
}

function palettesEqual(left: { entries: PaletteEntry[] }, right: { entries: PaletteEntry[] }): boolean {
  if (left.entries.length !== right.entries.length) return false;

  return left.entries.every((entry, index) => {
    const other = right.entries[index];
    if (
      !other ||
      entry.type !== other.type ||
      entry.id !== other.id ||
      entry.index !== other.index ||
      entry.name !== other.name
    ) {
      return false;
    }

    if (entry.type === "solid" && other.type === "solid") {
      return entry.value === other.value;
    }

    if (entry.type === "pattern" && other.type === "pattern") {
      return (
        entry.patternId === other.patternId &&
        entry.offsetX === other.offsetX &&
        entry.offsetY === other.offsetY &&
        entry.rotation === other.rotation &&
        entry.reflectX === other.reflectX &&
        entry.reflectY === other.reflectY &&
        entry.previewHue === other.previewHue
      );
    }

    return false;
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
    left.pixelEditable !== right.pixelEditable
  ) {
    return false;
  }

  if (left.type === "object" && right.type === "object") {
    return left.objectId === right.objectId && left.x === right.x && left.y === right.y && masksEqual(left, right);
  }

  if (left.type === "pixel" && right.type === "pixel") {
    return pixelLayersEqual(left, right) && masksEqual(left, right);
  }

  return false;
}

function masksEqual(left: Layer, right: Layer): boolean {
  if (!left.alphaMask && !right.alphaMask) return true;
  if (!left.alphaMask || !right.alphaMask) return false;
  if (
    left.alphaMask.width !== right.alphaMask.width ||
    left.alphaMask.height !== right.alphaMask.height ||
    left.alphaMask.data.length !== right.alphaMask.data.length
  ) {
    return false;
  }

  for (let index = 0; index < left.alphaMask.data.length; index += 1) {
    if (left.alphaMask.data[index] !== right.alphaMask.data[index]) return false;
  }
  return true;
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

function selectionStatesEqual(left: SelectionState | null, right: SelectionState | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (
    left.mask.width !== right.mask.width ||
    left.mask.height !== right.mask.height ||
    left.mask.data.length !== right.mask.data.length
  ) {
    return false;
  }

  for (let index = 0; index < left.mask.data.length; index += 1) {
    if (left.mask.data[index] !== right.mask.data[index]) return false;
  }
  return true;
}
