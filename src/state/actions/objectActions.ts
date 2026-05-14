import {
  clampLayerIndex,
  cloneObjectDefinition,
  createObjectDefinition,
  createObjectInstanceLayer,
  resizeSurface,
} from "../../domain/layers";
import { resizeBinaryMaskSurface } from "../../domain/masks";
import {
  clampObjectDimension,
  pushCurrentCommand,
  snapshotFrom,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type ObjectActions = Pick<
  EditorStoreState,
  "switchToRoot" | "switchToObject" | "addObject" | "duplicateObject" | "deleteObject" | "renameObject" | "resizeObject" | "placeObjectOnRoot"
>;

export function createObjectActions(set: EditorStoreSet, get: EditorStoreGet): ObjectActions {
  return {
    switchToRoot: () =>
      set((state) => {
        if (state.activeContext.type === "root") {
          return {
            canvasToolPreview: null,
            activeSelectionCombineMode: null,
            pendingMove: null,
            pendingSelectionMove: null,
            cursorLabel: "x: -- y: --",
            objectSelection: null,
          };
        }

        return {
          activeContext: { type: "root" },
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          pendingMove: null,
          pendingSelectionMove: null,
          cursorLabel: "x: -- y: --",
          objectSelection: null,
          status: "Editing root canvas",
          viewRevision: state.viewRevision + 1,
        };
      }),

    switchToObject: (objectId) =>
      set((state) => {
        const object = state.objects.find((candidate) => candidate.id === objectId);
        if (!object) return { status: "Object was not found" };
        return {
          activeContext: { type: "object", objectId },
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          pendingMove: null,
          pendingSelectionMove: null,
          objectSelection: null,
          cursorLabel: "x: -- y: --",
          status: `Editing ${object.name}`,
          viewRevision:
            state.activeContext.type === "object" && state.activeContext.objectId === objectId
              ? state.viewRevision
              : state.viewRevision + 1,
        };
      }),

    addObject: () => {
      const before = snapshotFrom(get());
      const object = createObjectDefinition(crypto.randomUUID(), `Object ${get().objects.length + 1}`, 32, 32);
      set((state) => ({
        objects: [...state.objects, object],
        activeContext: { type: "object", objectId: object.id },
        canvasToolPreview: null,
        activeSelectionCombineMode: null,
        editTarget: "pixels",
        objectSelection: null,
        status: `Created ${object.name}`,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      }));
      pushCurrentCommand(set, get, `Create ${object.name}`, before);
    },

    duplicateObject: (objectId) => {
      const sourceObject = get().objects.find((object) => object.id === objectId);
      if (!sourceObject) {
        set({ status: "Object was not found" });
        return;
      }

      const before = snapshotFrom(get());
      const object = {
        ...cloneObjectDefinition(sourceObject),
        id: crypto.randomUUID(),
        name: `${sourceObject.name} Copy`,
      };
      set((state) => {
        const sourceIndex = state.objects.findIndex((candidate) => candidate.id === objectId);
        const objects = [...state.objects];
        objects.splice(sourceIndex + 1, 0, object);

        return {
          objects,
          activeContext: { type: "object", objectId: object.id },
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          editTarget: "pixels",
          objectSelection: null,
          status: `Duplicated ${sourceObject.name}`,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, `Duplicate ${sourceObject.name}`, before);
    },

    deleteObject: (objectId) => {
      const object = get().objects.find((candidate) => candidate.id === objectId);
      if (!object) {
        set({ status: "Object was not found" });
        return;
      }

      const before = snapshotFrom(get());
      set((state) => {
        const rootLayers = state.root.layers.filter((layer) => layer.type !== "object" || layer.objectId !== objectId);
        const activeLayerIndex = clampLayerIndex(state.root.activeLayerIndex, rootLayers.length);

        return {
          objects: state.objects.filter((candidate) => candidate.id !== objectId),
          root: {
            ...state.root,
            activeLayerIndex,
            layers: rootLayers,
          },
          activeContext:
            state.activeContext.type === "object" && state.activeContext.objectId === objectId
              ? { type: "root" }
              : state.activeContext,
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          editTarget: "pixels",
          objectSelection:
            state.activeContext.type === "object" && state.activeContext.objectId === objectId
              ? null
              : state.objectSelection,
          status: `${object.name} removed`,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, `Remove ${object.name}`, before);
    },

    renameObject: (objectId, name) => {
      const before = snapshotFrom(get());
      set((state) => ({
        objects: state.objects.map((object) => (object.id === objectId ? { ...object, name } : object)),
        root: {
          ...state.root,
          layers: state.root.layers.map((layer) =>
            layer.type === "object" && layer.objectId === objectId ? { ...layer, name } : layer,
          ),
        },
        status: "Object renamed",
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      }));
      pushCurrentCommand(set, get, "Rename object", before);
    },

    resizeObject: (objectId, width, height) => {
      const nextWidth = clampObjectDimension(width);
      const nextHeight = clampObjectDimension(height);
      const currentObject = get().objects.find((object) => object.id === objectId);
      if (!currentObject || (currentObject.width === nextWidth && currentObject.height === nextHeight)) return;
      const before = snapshotFrom(get());
      set((state) => ({
        objects: state.objects.map((object) =>
          object.id === objectId
            ? {
                ...object,
                width: nextWidth,
                height: nextHeight,
                layers: object.layers.map((layer) => ({
                  ...layer,
                  contentRevision: layer.contentRevision + 1,
                  alphaMask: layer.alphaMask ? resizeBinaryMaskSurface(layer.alphaMask, nextWidth, nextHeight) : undefined,
                  surface: resizeSurface(layer.surface, nextWidth, nextHeight),
                })),
              }
            : object,
        ),
        status: "Object resized",
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      }));
      pushCurrentCommand(set, get, "Resize object", before);
    },

    placeObjectOnRoot: (objectId, point) => {
      const object = get().objects.find((candidate) => candidate.id === objectId);
      if (!object) {
        set({ status: "Object was not found" });
        return;
      }
      const before = snapshotFrom(get());
      set((state) => {
        const layer = createObjectInstanceLayer(state.root.nextLayerId, object.name, objectId);
        layer.x = point?.x ?? Math.floor((state.root.width - object.width) / 2);
        layer.y = point?.y ?? Math.floor((state.root.height - object.height) / 2);
        const layers = [...state.root.layers];
        layers.splice(state.root.activeLayerIndex + 1, 0, layer);
        return {
          root: {
            ...state.root,
            nextLayerId: state.root.nextLayerId + 1,
            layers,
            activeLayerIndex: state.root.activeLayerIndex + 1,
          },
          activeContext: { type: "root" },
          status: `${object.name} instance added`,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, `Place ${object.name}`, before);
    },
  };
}
