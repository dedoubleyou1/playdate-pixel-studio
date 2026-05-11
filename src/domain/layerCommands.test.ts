import { describe, expect, it } from "vitest";
import { indexFor } from "./pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import {
  addPixelLayer,
  clearActivePixelLayer,
  deleteActiveLayer,
  duplicateActiveLayer,
  hasLayerStackMutation,
  invertActivePixelLayer,
  moveActiveLayer,
  reorderLayer,
  setLayerVisibility,
  setStackBackgroundColor,
  translateActiveLayerFrom,
  translateLayer,
} from "./layerCommands";
import { createObjectDefinition, createObjectInstanceLayer, createRootStack } from "./layers";

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

  it("reorders layers while keeping the same active layer selected", () => {
    const stack = addPixelLayer(addPixelLayer(createRootStack()).stack).stack;
    const activeLayerId = stack.layers[stack.activeLayerIndex].id;

    const result = reorderLayer(stack, 0, 2);

    expect(hasLayerStackMutation(result)).toBe(true);
    if (!hasLayerStackMutation(result)) throw new Error("Expected layer reorder");
    expect(result.stack.layers.map((layer) => layer.id)).toEqual([2, 3, 1]);
    expect(result.stack.layers[result.stack.activeLayerIndex].id).toBe(activeLayerId);
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

  it("translates pixel layers with clipping", () => {
    const stack = createRootStack();
    const layer = stack.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected pixel layer");
    layer.surface.data[indexFor(0, 0)] = BLACK_PIXEL;
    layer.surface.data[indexFor(2, 1)] = WHITE_PIXEL;

    const translated = translateLayer(layer, 1, 1);
    if (translated.type !== "pixel") throw new Error("Expected translated pixel layer");

    expect(translated.surface.data[indexFor(1, 1)]).toBe(BLACK_PIXEL);
    expect(translated.surface.data[indexFor(3, 2)]).toBe(WHITE_PIXEL);
    expect(translated.surface.data[indexFor(0, 0)]).toBe(TRANSPARENT_PIXEL);

    const clipped = translateLayer(layer, -1, -1);
    if (clipped.type !== "pixel") throw new Error("Expected clipped pixel layer");
    expect(clipped.surface.data[indexFor(0, 0)]).toBe(TRANSPARENT_PIXEL);
    expect(clipped.surface.data[indexFor(1, 0)]).toBe(WHITE_PIXEL);
  });

  it("translates object instance layers without changing source objects", () => {
    const object = createObjectDefinition("object-1", "Object 1", 8, 8);
    const layer = createObjectInstanceLayer(2, "Object 1", object.id);
    layer.x = 4;
    layer.y = 5;

    const translated = translateLayer(layer, -2, 3);
    if (translated.type !== "object") throw new Error("Expected translated object layer");

    expect(translated).toMatchObject({ x: 2, y: 8, objectId: object.id });
    expect(object.layers).toHaveLength(1);
  });

  it("translates the selected layer from an original source layer", () => {
    const stack = createRootStack();
    const layer = stack.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected pixel layer");
    layer.surface.data[indexFor(1, 1)] = BLACK_PIXEL;

    const result = translateActiveLayerFrom(stack, layer, 0, 2, 0);
    expect(hasLayerStackMutation(result)).toBe(true);
    if (!hasLayerStackMutation(result)) throw new Error("Expected translated stack");
    const moved = result.stack.layers[0];
    if (moved.type !== "pixel") throw new Error("Expected moved pixel layer");
    expect(moved.surface.data[indexFor(3, 1)]).toBe(BLACK_PIXEL);
  });
});
