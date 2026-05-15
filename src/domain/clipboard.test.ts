import { describe, expect, it } from "vitest";
import { createSurface } from "./layers";
import { createBinaryMaskSurface, createSelectionStateFromMask } from "./masks";
import { indexFor } from "./pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import {
  clearSelectedPixels,
  createClipboardFromSelection,
  pasteClipboardPixels,
  selectionFromClipboardMask,
  type EditorClipboard,
} from "./clipboard";

describe("editor clipboard domain helpers", () => {
  it("builds cropped clipboard payloads from selected pixels", () => {
    const layer = pixelLayer(4, 4);
    layer.surface.data[indexFor(1, 1, 4)] = BLACK_PIXEL;
    layer.surface.data[indexFor(2, 1, 4)] = WHITE_PIXEL;
    layer.surface.data[indexFor(2, 2, 4)] = BLACK_PIXEL;
    const mask = createBinaryMaskSurface(4, 4);
    mask.data[indexFor(1, 1, 4)] = 1;
    mask.data[indexFor(2, 1, 4)] = 1;
    mask.data[indexFor(1, 2, 4)] = 1;
    const selection = createSelectionStateFromMask(mask);

    const clipboard = createClipboardFromSelection(layer, selection);

    expect(clipboard?.origin).toEqual({ x: 1, y: 1 });
    expect(Array.from(clipboard?.surface.data ?? [])).toEqual([BLACK_PIXEL, WHITE_PIXEL, TRANSPARENT_PIXEL, TRANSPARENT_PIXEL]);
    expect(Array.from(clipboard?.mask.data ?? [])).toEqual([1, 1, 1, 0]);
  });

  it("clears selected pixels and stamps only non-transparent clipboard pixels", () => {
    const layer = pixelLayer(4, 4);
    layer.surface.data[indexFor(1, 1, 4)] = BLACK_PIXEL;
    const mask = createBinaryMaskSurface(4, 4);
    mask.data[indexFor(1, 1, 4)] = 1;
    const selection = createSelectionStateFromMask(mask);
    const cleared = clearSelectedPixels(layer, selection);

    expect(cleared.surface.data[indexFor(1, 1, 4)]).toBe(TRANSPARENT_PIXEL);

    const clipboard = clipboardPayload(1, 1);
    const stamped = pasteClipboardPixels(layer, clipboard);

    expect(stamped.surface.data[indexFor(1, 1, 4)]).toBe(BLACK_PIXEL);
    expect(stamped.surface.data[indexFor(2, 1, 4)]).toBe(TRANSPARENT_PIXEL);
    expect(stamped.surface.data[indexFor(1, 2, 4)]).toBe(WHITE_PIXEL);
  });

  it("clips pasted selection masks to the target bounds", () => {
    const selection = selectionFromClipboardMask(clipboardPayload(3, 3), 4, 4);

    expect(selection?.bounds).toEqual({ left: 3, top: 3, right: 3, bottom: 3 });
    expect(selection?.mask.data[indexFor(3, 3, 4)]).toBe(1);
  });
});

function clipboardPayload(x: number, y: number): EditorClipboard {
  return {
    kind: "pixel-selection",
    origin: { x, y },
    schemaVersion: 1,
    surface: createSurface(2, 2, new Uint8Array([BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL, TRANSPARENT_PIXEL])),
    mask: createBinaryMaskSurface(2, 2, true),
  };
}

function pixelLayer(width: number, height: number) {
  return {
    type: "pixel" as const,
    id: 1,
    name: "Layer",
    visible: true,
    pixelEditable: true,
    contentRevision: 0,
    surface: createSurface(width, height),
  };
}
