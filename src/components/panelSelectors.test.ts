import { describe, expect, it } from "vitest";
import { BLACK_PIXEL, WHITE_PIXEL } from "../domain/types";
import { createBinaryMaskSurface } from "../domain/masks";
import { createLayer, createObjectDefinition, createObjectInstanceLayer, createRootStack } from "../domain/layers";
import { createDefaultPalette } from "../domain/layers";
import type { EditorStoreState } from "../state/editorStoreTypes";
import {
  areLayerPanelModelsEqual,
  areObjectLibraryModelsEqual,
  selectLayerPanelModel,
  selectLayerThumbnailKey,
  selectObjectLibraryModel,
  selectObjectThumbnailKey,
} from "./panelSelectors";

describe("panel selectors", () => {
  it("keeps layer metadata stable for pixel-only changes", () => {
    const state = testState();
    const originalLayer = state.root.layers[0];
    if (originalLayer.type !== "pixel") throw new Error("Expected pixel layer");
    originalLayer.surface.data[0] = BLACK_PIXEL;
    const before = selectLayerPanelModel(state);
    const next = testState();
    const nextLayer = next.root.layers[0];
    if (nextLayer.type !== "pixel") throw new Error("Expected pixel layer");
    next.root.layers[0] = {
      ...nextLayer,
      contentRevision: nextLayer.contentRevision + 1,
      surface: { ...nextLayer.surface, data: new Uint8Array(nextLayer.surface.data) },
    };
    const changedLayer = next.root.layers[0];
    if (changedLayer.type !== "pixel") throw new Error("Expected pixel layer");
    changedLayer.surface.data[0] = WHITE_PIXEL;

    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(next))).toBe(true);
  });

  it("changes layer metadata for displayed layer state", () => {
    const state = testState();
    const before = selectLayerPanelModel(state);

    const renamed = testState();
    renamed.root.layers[0] = { ...renamed.root.layers[0], name: "Renamed" };
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(renamed))).toBe(false);

    const hidden = testState();
    hidden.root.layers[0] = { ...hidden.root.layers[0], visible: false };
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(hidden))).toBe(false);

    const masked = testState();
    masked.root.layers[0] = { ...masked.root.layers[0], alphaMask: createBinaryMaskSurface(2, 2, true) };
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(masked))).toBe(false);

    const activeChanged = testState();
    activeChanged.root.layers.push(createLayer(2, "Layer 2", 2, 2));
    activeChanged.root.activeLayerIndex = 1;
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(activeChanged))).toBe(false);

    const editTargetChanged = testState();
    editTargetChanged.editTarget = "alphaMask";
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(editTargetChanged))).toBe(false);

    const backgroundChanged = testState();
    backgroundChanged.root.background = BLACK_PIXEL;
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(backgroundChanged))).toBe(false);
  });

  it("changes layer metadata for order, type, object placement, and active context", () => {
    const state = testState();
    state.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    state.root.layers.push(createLayer(2, "Layer 2", 2, 2));
    const before = selectLayerPanelModel(state);

    const reordered = testState();
    reordered.objects = state.objects;
    reordered.root.layers = [createLayer(2, "Layer 2", 2, 2), createLayer(1, "Layer 1", 2, 2)];
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(reordered))).toBe(false);

    const objectLayer = testState();
    objectLayer.objects = state.objects;
    objectLayer.root.layers[0] = createObjectInstanceLayer(1, "Object", "object-1");
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(objectLayer))).toBe(false);

    const movedObjectLayer = testState();
    movedObjectLayer.objects = state.objects;
    const moved = createObjectInstanceLayer(1, "Object", "object-1");
    moved.x = 4;
    movedObjectLayer.root.layers[0] = moved;
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(movedObjectLayer))).toBe(false);

    const objectContext = testState();
    objectContext.objects = state.objects;
    objectContext.activeContext = { type: "object", objectId: "object-1" };
    expect(areLayerPanelModelsEqual(before, selectLayerPanelModel(objectContext))).toBe(false);
  });

  it("keeps object library metadata stable for object pixel-only changes", () => {
    const state = testState();
    state.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    const before = selectObjectLibraryModel(state);

    const changed = testState();
    changed.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    changed.objects[0].layers[0] = {
      ...changed.objects[0].layers[0],
      contentRevision: changed.objects[0].layers[0].contentRevision + 1,
    };

    expect(areObjectLibraryModelsEqual(before, selectObjectLibraryModel(changed))).toBe(true);
  });

  it("changes object library metadata for displayed object state", () => {
    const state = testState();
    state.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    const before = selectObjectLibraryModel(state);

    const renamed = testState();
    renamed.objects = [createObjectDefinition("object-1", "Renamed", 2, 2)];
    expect(areObjectLibraryModelsEqual(before, selectObjectLibraryModel(renamed))).toBe(false);

    const resized = testState();
    resized.objects = [createObjectDefinition("object-1", "Object", 3, 2)];
    expect(areObjectLibraryModelsEqual(before, selectObjectLibraryModel(resized))).toBe(false);

    const reordered = testState();
    reordered.objects = [
      createObjectDefinition("object-2", "Object 2", 2, 2),
      createObjectDefinition("object-1", "Object", 2, 2),
    ];
    expect(areObjectLibraryModelsEqual(before, selectObjectLibraryModel(reordered))).toBe(false);

    const activeObject = testState();
    activeObject.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    activeObject.activeContext = { type: "object", objectId: "object-1" };
    expect(areObjectLibraryModelsEqual(before, selectObjectLibraryModel(activeObject))).toBe(false);
  });

  it("changes thumbnail keys for content, palette, masks, and referenced objects", () => {
    const state = testState();
    state.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    state.root.layers = [createObjectInstanceLayer(1, "Object", "object-1")];
    const layerKey = selectLayerThumbnailKey(state, "root", 1);
    const objectKey = selectObjectThumbnailKey(state, "object-1");

    const contentChanged = testState();
    contentChanged.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    contentChanged.root.layers = [createObjectInstanceLayer(1, "Object", "object-1")];
    contentChanged.objects[0].layers[0].contentRevision += 1;
    expect(selectLayerThumbnailKey(contentChanged, "root", 1)).not.toBe(layerKey);
    expect(selectObjectThumbnailKey(contentChanged, "object-1")).not.toBe(objectKey);

    const maskChanged = testState();
    maskChanged.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    maskChanged.root.layers = [createObjectInstanceLayer(1, "Object", "object-1")];
    maskChanged.root.layers[0].alphaMask = createBinaryMaskSurface(2, 2, true);
    expect(selectLayerThumbnailKey(maskChanged, "root", 1)).not.toBe(layerKey);

    const paletteChanged = testState();
    paletteChanged.objects = [createObjectDefinition("object-1", "Object", 2, 2)];
    paletteChanged.root.layers = [createObjectInstanceLayer(1, "Object", "object-1")];
    paletteChanged.palette = {
      entries: paletteChanged.palette.entries.map((entry) =>
        entry.index === BLACK_PIXEL && entry.type === "solid" ? { ...entry, value: "white" } : entry,
      ),
    };
    expect(selectLayerThumbnailKey(paletteChanged, "root", 1)).not.toBe(layerKey);
    expect(selectObjectThumbnailKey(paletteChanged, "object-1")).not.toBe(objectKey);
  });
});

function testState(): EditorStoreState {
  return {
    activeContext: { type: "root" },
    editTarget: "pixels",
    objects: [],
    palette: createDefaultPalette(),
    root: createRootStackWithSize(2, 2),
  } as unknown as EditorStoreState;
}

function createRootStackWithSize(width: number, height: number): ReturnType<typeof createRootStack> {
  const stack = createRootStack();
  stack.width = width;
  stack.height = height;
  stack.layers = [createLayer(1, "Layer 1", width, height)];
  return stack;
}
