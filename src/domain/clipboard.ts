import { createSurface } from "./layers";
import {
  cloneBinaryMaskSurface,
  createBinaryMaskSurface,
  createSelectionStateFromMask,
  liftSelectedPixels,
  pasteFloatingPixels,
} from "./masks";
import { indexFor } from "./pixelGeometry";
import { TRANSPARENT_PIXEL, type BinaryMaskSurface, type PixelLayer, type PixelSurface, type Point, type SelectionState } from "./types";

export const EDITOR_CLIPBOARD_SCHEMA_VERSION = 1;
export const EDITOR_CLIPBOARD_KIND = "pixel-selection";

export interface EditorClipboard {
  kind: typeof EDITOR_CLIPBOARD_KIND;
  origin: Point;
  schemaVersion: typeof EDITOR_CLIPBOARD_SCHEMA_VERSION;
  surface: PixelSurface;
  mask: BinaryMaskSurface;
}

export function createClipboardFromSelection(layer: PixelLayer, selection: SelectionState): EditorClipboard | null {
  if (!selection.bounds || selection.isEmpty) return null;

  const { left, top, right, bottom } = selection.bounds;
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width <= 0 || height <= 0) return null;

  const surface = createSurface(width, height);
  const mask = createBinaryMaskSurface(width, height);

  for (let y = 0; y < height; y += 1) {
    const sourceY = top + y;
    if (sourceY < 0 || sourceY >= selection.mask.height || sourceY >= layer.surface.height) continue;
    for (let x = 0; x < width; x += 1) {
      const sourceX = left + x;
      if (sourceX < 0 || sourceX >= selection.mask.width || sourceX >= layer.surface.width) continue;
      const sourceIndex = indexFor(sourceX, sourceY, selection.mask.width);
      if (!selection.mask.data[sourceIndex]) continue;
      const targetIndex = indexFor(x, y, width);
      mask.data[targetIndex] = 1;
      surface.data[targetIndex] = layer.surface.data[indexFor(sourceX, sourceY, layer.surface.width)];
    }
  }

  return {
    kind: EDITOR_CLIPBOARD_KIND,
    origin: { x: left, y: top },
    schemaVersion: EDITOR_CLIPBOARD_SCHEMA_VERSION,
    surface,
    mask,
  };
}

export function clearSelectedPixels(layer: PixelLayer, selection: SelectionState): PixelLayer {
  return bumpContentRevisionIfPixelsChanged(layer, liftSelectedPixels(layer, selection.mask).source);
}

export function pasteClipboardPixels(layer: PixelLayer, clipboard: EditorClipboard): PixelLayer {
  return bumpContentRevisionIfPixelsChanged(layer, pasteFloatingPixels(layer, clipboard.surface, clipboard.origin.x, clipboard.origin.y));
}

export function selectionFromClipboardMask(
  clipboard: Pick<EditorClipboard, "mask" | "origin">,
  width: number,
  height: number,
): SelectionState | null {
  const mask = createBinaryMaskSurface(width, height);
  for (let y = 0; y < clipboard.mask.height; y += 1) {
    const targetY = clipboard.origin.y + y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < clipboard.mask.width; x += 1) {
      if (!clipboard.mask.data[indexFor(x, y, clipboard.mask.width)]) continue;
      const targetX = clipboard.origin.x + x;
      if (targetX < 0 || targetX >= width) continue;
      mask.data[indexFor(targetX, targetY, width)] = 1;
    }
  }

  const selection = createSelectionStateFromMask(mask);
  return selection.isEmpty ? null : selection;
}

export function cloneEditorClipboard(clipboard: EditorClipboard): EditorClipboard {
  return {
    kind: clipboard.kind,
    origin: { ...clipboard.origin },
    schemaVersion: clipboard.schemaVersion,
    surface: {
      width: clipboard.surface.width,
      height: clipboard.surface.height,
      data: new Uint8Array(clipboard.surface.data),
    },
    mask: cloneBinaryMaskSurface(clipboard.mask),
  };
}

export function surfaceHasNonTransparentPixels(surface: PixelSurface): boolean {
  return surface.data.some((pixel) => pixel !== TRANSPARENT_PIXEL);
}

function bumpContentRevisionIfPixelsChanged(previous: PixelLayer, next: PixelLayer): PixelLayer {
  if (surfaceDataEqual(previous.surface.data, next.surface.data)) return next;
  return { ...next, contentRevision: previous.contentRevision + 1 };
}

function surfaceDataEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
