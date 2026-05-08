import { describe, expect, it } from "vitest";
import { indexFor } from "./pixelOps";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import {
  addPixelLayer,
  clearActivePixelLayer,
  deleteActiveLayer,
  duplicateActiveLayer,
  hasLayerStackMutation,
  invertActivePixelLayer,
  moveActiveLayer,
  setLayerVisibility,
  setStackBackgroundColor,
} from "./layerCommands";
import { createRootStack } from "./layers";

describe("layer commands", () => {
  it("adds a pixel layer above the active layer", () => {
    const result = addPixelLayer(createRootStack());

    expect(result.stack.layers).toHaveLength(2);
    expect(result.stack.activeLayerIndex).toBe(1);
    expect(result.stack.nextLayerId).toBe(3);
    expect(result.stack.layers[1]).toMatchObject({ id: 2, name: "Layer 2", type: "pixel" });
  });

  it("duplicates the active layer with cloned pixel data", () => {
    const stack = createRootStack();
    const layer = stack.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected pixel layer");
    layer.surface.data[indexFor(3, 3)] = BLACK_PIXEL;

    const result = duplicateActiveLayer(stack);
    const copiedLayer = result.stack.layers[1];
    if (copiedLayer.type !== "pixel") throw new Error("Expected copied pixel layer");

    expect(result.stack.activeLayerIndex).toBe(1);
    expect(copiedLayer.id).toBe(2);
    expect(copiedLayer.name).toBe("Layer 1 copy");
    expect(copiedLayer.surface.data[indexFor(3, 3)]).toBe(BLACK_PIXEL);
    expect(copiedLayer.surface.data).not.toBe(layer.surface.data);
  });

  it("does not delete the only layer", () => {
    expect(hasLayerStackMutation(deleteActiveLayer(createRootStack()))).toBe(false);
  });

  it("moves the active layer when the target is valid", () => {
    const stack = addPixelLayer(createRootStack()).stack;

    const result = moveActiveLayer(stack, -1);

    expect(hasLayerStackMutation(result)).toBe(true);
    if (hasLayerStackMutation(result)) {
      expect(result.stack.activeLayerIndex).toBe(0);
      expect(result.stack.layers.map((layer) => layer.id)).toEqual([2, 1]);
    }
  });

  it("updates visibility and background", () => {
    const hidden = setLayerVisibility(createRootStack(), 0, false);
    const background = setStackBackgroundColor(hidden.stack, BLACK_PIXEL);

    expect(hidden.stack.layers[0].visible).toBe(false);
    expect(hasLayerStackMutation(background)).toBe(true);
    if (hasLayerStackMutation(background)) {
      expect(background.stack.background).toBe(BLACK_PIXEL);
    }
  });

  it("clears and inverts active pixel layers", () => {
    const stack = createRootStack();
    const layer = stack.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected pixel layer");
    layer.surface.data[indexFor(1, 1)] = BLACK_PIXEL;
    layer.surface.data[indexFor(2, 1)] = WHITE_PIXEL;

    const inverted = invertActivePixelLayer(stack);
    expect(hasLayerStackMutation(inverted)).toBe(true);
    if (!hasLayerStackMutation(inverted)) throw new Error("Expected inverted layer stack");
    const invertedLayer = inverted.stack.layers[0];
    if (invertedLayer.type !== "pixel") throw new Error("Expected pixel layer");
    expect(invertedLayer.surface.data[indexFor(1, 1)]).toBe(WHITE_PIXEL);
    expect(invertedLayer.surface.data[indexFor(2, 1)]).toBe(BLACK_PIXEL);

    const cleared = clearActivePixelLayer(inverted.stack);
    expect(hasLayerStackMutation(cleared)).toBe(true);
    if (!hasLayerStackMutation(cleared)) throw new Error("Expected cleared layer stack");
    const clearedLayer = cleared.stack.layers[0];
    if (clearedLayer.type !== "pixel") throw new Error("Expected pixel layer");
    expect(clearedLayer.surface.data.every((pixel) => pixel === TRANSPARENT_PIXEL)).toBe(true);
    expect(clearedLayer.contentRevision).toBe(invertedLayer.contentRevision + 1);
  });
});
