import { snapshotsEqual } from "../../domain/commands";
import {
  addPixelLayer,
  activePixelLayerUsesPatternSwatches,
  clearActivePixelLayer,
  deleteActiveLayer,
  duplicateActiveLayer,
  hasLayerStackMutation,
  invertActivePixelLayer,
  moveActiveLayer,
  reorderLayer as reorderLayerCommand,
  setActiveLayerName,
  setLayerVisibility,
  setStackBackgroundColor,
  translateActiveLayerFrom,
} from "../../domain/layerCommands";
import { activeStack, clampLayerIndex, cloneLayer } from "../../domain/layers";
import {
  canvasSelectionToLayerMask,
  cloneBinaryMaskSurface,
  createBinaryMaskSurface,
  createSelectionStateFromMask,
  liftSelectedPixels,
  maskIsEmpty,
  pasteFloatingPixels,
  translateBinaryMaskSurface,
} from "../../domain/masks";
import { paletteEntryLabel } from "../../domain/palette";
import type { PixelLayer } from "../../domain/types";
import {
  activeSelection,
  editContextsEqual,
  layerAlphaMaskSize,
  pushCurrentCommand,
  replaceActiveStack,
  selectionSnapshot,
  setActiveSelectionStateFields,
  snapshotFrom,
  snapshotState,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type LayerActions = Pick<
  EditorStoreState,
  | "addActiveLayerAlphaMask"
  | "removeActiveLayerAlphaMask"
  | "beginMoveLayer"
  | "previewSelectionMove"
  | "commitMoveLayer"
  | "cancelMoveLayer"
  | "addLayer"
  | "duplicateLayer"
  | "deleteLayer"
  | "moveLayer"
  | "reorderLayer"
  | "setActiveLayer"
  | "renameLayer"
  | "setLayerVisible"
  | "setStackBackground"
  | "clearActiveLayer"
  | "invertActiveLayer"
>;

export function createLayerActions(set: EditorStoreSet, get: EditorStoreGet): LayerActions {
  return {
    addActiveLayerAlphaMask: () => {
      const before = snapshotFrom(get());
      let label = "Add alpha mask";
      set((current) => {
        const stack = activeStack(current);
        const layer = stack.layers[stack.activeLayerIndex];
        if (!layer) return { status: "Select a layer first" };
        if (layer.alphaMask) return { status: "Layer already has an alpha mask" };
        const size = layerAlphaMaskSize(layer, current.objects);
        if (!size) return { status: "Layer cannot be masked" };

        const selection = activeSelection(current);
        const hasSelection = Boolean(selection && !maskIsEmpty(selection.mask));
        const offset = layer.type === "object" ? { x: layer.x, y: layer.y } : { x: 0, y: 0 };
        const alphaMask =
          selection && hasSelection
            ? canvasSelectionToLayerMask(selection.mask, size.width, size.height, offset)
            : createBinaryMaskSurface(size.width, size.height, true);
        label = hasSelection ? "Selection to alpha mask" : "Add alpha mask";

        return {
          ...replaceActiveStack(current, {
            ...stack,
            layers: stack.layers.map((candidate, index) =>
              index === stack.activeLayerIndex ? { ...candidate, alphaMask } : candidate,
            ),
          }),
          status: hasSelection ? "Selection applied to alpha mask" : "Alpha mask added",
          documentRevision: current.documentRevision + 1,
          viewRevision: current.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, label, before);
    },

    removeActiveLayerAlphaMask: () => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const layer = stack.layers[stack.activeLayerIndex];
        if (!layer?.alphaMask) return { status: "Layer has no alpha mask" };
        return {
          ...replaceActiveStack(state, {
            ...stack,
            layers: stack.layers.map((candidate, index) =>
              index === stack.activeLayerIndex ? { ...candidate, alphaMask: undefined } : candidate,
            ),
          }),
          status: "Alpha mask removed",
          editTarget: state.editTarget === "alphaMask" ? "pixels" : state.editTarget,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Remove alpha mask", before);
    },

    beginMoveLayer: () => {
      const state = get();
      const stack = activeStack(state);
      const layer = stack.layers[stack.activeLayerIndex];
      if (!layer) {
        set({ status: "Select a layer to move" });
        return false;
      }

      const selection = activeSelection(state);
      if (state.editTarget === "pixels" && layer.type === "pixel") {
        const before = snapshotFrom(get());
        const originalLayer = cloneLayer(layer) as PixelLayer;
        const implicitFullLayer = !selection || maskIsEmpty(selection.mask);
        const moveSelection = implicitFullLayer
          ? createSelectionStateFromMask(createBinaryMaskSurface(layer.surface.width, layer.surface.height, true))
          : selection;
        const lifted = liftSelectedPixels(originalLayer, moveSelection.mask);
        set({
          pendingCommand: {
            label: implicitFullLayer ? "Move layer" : "Move selected pixels",
            before,
            beforeSelection: selectionSnapshot(get()),
          },
          pendingSelectionMove: {
            before,
            context: state.activeContext,
            dx: 0,
            dy: 0,
            floating: {
              layerIndex: stack.activeLayerIndex,
              mask: cloneBinaryMaskSurface(moveSelection.mask),
              surface: lifted.floating,
            },
            implicitFullLayer,
            selection: createSelectionStateFromMask(cloneBinaryMaskSurface(moveSelection.mask)),
            sourceLayer: lifted.source,
          },
          pendingMove: null,
          status: implicitFullLayer ? "Moving layer" : "Moving selected pixels",
        });
        return true;
      }

      const before = snapshotFrom(get());
      set({
        pendingCommand: { label: "Move layer", before, beforeSelection: selectionSnapshot(get()) },
        pendingMove: {
          before,
          context: state.activeContext,
          dx: 0,
          dy: 0,
          layer: cloneLayer(layer),
          layerIndex: stack.activeLayerIndex,
        },
        status: "Moving layer",
      });
      return true;
    },

    previewSelectionMove: (dx, dy) =>
      set((state) => {
        const pendingSelectionMove = state.pendingSelectionMove;
        if (!pendingSelectionMove || (pendingSelectionMove.dx === dx && pendingSelectionMove.dy === dy)) return {};
        return {
          pendingSelectionMove: {
            ...pendingSelectionMove,
            dx,
            dy,
          },
        };
      }),

    commitMoveLayer: (dx, dy) => {
      const pendingSelectionMove = get().pendingSelectionMove;
      if (pendingSelectionMove) {
        const current = get();
        if (!editContextsEqual(current.activeContext, pendingSelectionMove.context)) {
          set({
            pendingCommand: null,
            pendingSelectionMove: null,
            status: "Move cancelled",
          });
          return false;
        }

        if (dx !== 0 || dy !== 0) {
          set((state) => {
            const stack = activeStack(state);
            let movedLayer = pasteFloatingPixels(pendingSelectionMove.sourceLayer, pendingSelectionMove.floating.surface, dx, dy);
            if (pendingSelectionMove.implicitFullLayer && pendingSelectionMove.sourceLayer.alphaMask) {
              movedLayer = {
                ...movedLayer,
                alphaMask: translateBinaryMaskSurface(pendingSelectionMove.sourceLayer.alphaMask, dx, dy),
              };
            }
            const movedSelection = createSelectionStateFromMask(
              translateBinaryMaskSurface(pendingSelectionMove.selection.mask, dx, dy),
            );
            return {
              ...replaceActiveStack(state, {
                ...stack,
                layers: stack.layers.map((layer, index) =>
                  index === pendingSelectionMove.floating.layerIndex ? movedLayer : layer,
                ),
              }),
              ...(pendingSelectionMove.implicitFullLayer ? {} : setActiveSelectionStateFields(state, movedSelection)),
              status: pendingSelectionMove.implicitFullLayer ? `Layer moved ${dx}, ${dy}` : `Selected pixels moved ${dx}, ${dy}`,
            };
          });
        }

        const changed = !snapshotsEqual(pendingSelectionMove.before, snapshotFrom(get()));
        set({ pendingSelectionMove: null });
        if (changed) {
          get().markDocumentChanged(pendingSelectionMove.implicitFullLayer ? "Layer moved" : "Selected pixels moved");
        }
        get().commitCommand(pendingSelectionMove.implicitFullLayer ? "Move layer" : "Move selected pixels");
        return changed;
      }

      const pending = get().pendingMove;
      if (!pending) return false;
      const current = get();
      if (!editContextsEqual(current.activeContext, pending.context)) {
        set({
          pendingCommand: null,
          pendingMove: null,
          status: "Move cancelled",
        });
        return false;
      }

      if (dx !== 0 || dy !== 0) {
        set((state) => {
          const stack = activeStack(state);
          const result = translateActiveLayerFrom(stack, pending.layer, pending.layerIndex, dx, dy);
          if (!hasLayerStackMutation(result)) return { status: result.status ?? state.status };

          return {
            ...replaceActiveStack(state, result.stack),
            pendingMove: { ...pending, dx, dy },
            status: `${result.status} ${dx}, ${dy}`,
          };
        });
      }

      const changed = !snapshotsEqual(pending.before, snapshotFrom(get()));
      set({ pendingMove: null });
      if (changed) {
        get().markDocumentChanged("Layer moved");
      }
      get().commitCommand("Move layer");
      return changed;
    },

    cancelMoveLayer: () => {
      if (get().pendingSelectionMove) {
        set({
          pendingCommand: null,
          pendingSelectionMove: null,
          canvasToolPreview: null,
          activeSelectionCombineMode: null,
          status: "Move cancelled",
        });
        return;
      }
      const pending = get().pendingMove;
      if (!pending) return;
      set({
        ...snapshotState(pending.before),
        pendingCommand: null,
        pendingMove: null,
        canvasToolPreview: null,
        activeSelectionCombineMode: null,
        status: "Move cancelled",
      });
    },

    addLayer: () => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = addPixelLayer(stack);
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Add layer", before);
    },

    duplicateLayer: () => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = duplicateActiveLayer(stack);
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Duplicate layer", before);
    },

    deleteLayer: () => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = deleteActiveLayer(stack);
        if (!hasLayerStackMutation(result)) return {};
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Delete layer", before);
    },

    moveLayer: (direction) => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = moveActiveLayer(stack, direction);
        if (!hasLayerStackMutation(result)) return {};
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, direction > 0 ? "Move layer up" : "Move layer down", before);
    },

    reorderLayer: (fromIndex, toIndex) => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = reorderLayerCommand(stack, fromIndex, toIndex);
        if (!hasLayerStackMutation(result)) return {};
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Reorder layer", before);
    },

    setActiveLayer: (activeLayerIndex) => {
      set((state) => {
        const stack = activeStack(state);
        const nextActiveLayerIndex = clampLayerIndex(activeLayerIndex, stack.layers.length);
        const layer = stack.layers[nextActiveLayerIndex];
        return {
          ...setActiveStackActiveLayerIndex(state, nextActiveLayerIndex),
          status: layer?.type === "object" ? "Object instances are linked; edit the source object." : state.status,
        };
      });
    },

    renameLayer: (index, name) => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = setActiveLayerName(stack, index, name);
        return {
          ...replaceActiveStack(state, result.stack),
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Rename layer", before);
    },

    setLayerVisible: (index, visible) => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = setLayerVisibility(stack, index, visible);
        return {
          ...replaceActiveStack(state, result.stack),
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, visible ? "Show layer" : "Hide layer", before);
    },

    setStackBackground: (background) => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = setStackBackgroundColor(stack, background);
        if (!hasLayerStackMutation(result)) return {};
        return {
          ...replaceActiveStack(state, result.stack),
          status: `Background ${paletteEntryLabel(state.palette, background)}`,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Set background", before);
    },

    clearActiveLayer: () => {
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = clearActivePixelLayer(stack);
        if (!hasLayerStackMutation(result)) return { status: result.status };
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(set, get, "Clear layer", before);
    },

    invertActiveLayer: () => {
      const current = get();
      const currentStack = activeStack(current);
      const rasterizesPatterns = activePixelLayerUsesPatternSwatches(currentStack, current.palette);
      if (
        rasterizesPatterns &&
        typeof window !== "undefined" &&
        !window.confirm("This will rasterize pattern swatches on the active layer before inverting it. Continue?")
      ) {
        set({ status: "Invert layer cancelled" });
        return;
      }
      const before = snapshotFrom(get());
      set((state) => {
        const stack = activeStack(state);
        const result = invertActivePixelLayer(stack, state.palette);
        if (!hasLayerStackMutation(result)) return { status: result.status };
        return {
          ...replaceActiveStack(state, result.stack),
          status: result.status,
          documentRevision: state.documentRevision + 1,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: true,
        };
      });
      pushCurrentCommand(
        set,
        get,
        "Invert layer",
        before,
      );
    },
  };
}

function setActiveStackActiveLayerIndex(
  state: Pick<EditorStoreState, "activeContext" | "objects" | "root">,
  activeLayerIndex: number,
): Pick<EditorStoreState, "objects" | "root"> {
  if (state.activeContext.type === "root") {
    return {
      objects: state.objects,
      root: { ...state.root, activeLayerIndex },
    };
  }

  const context = state.activeContext;
  return {
    root: state.root,
    objects: state.objects.map((object) =>
      object.id === context.objectId ? { ...object, activeLayerIndex } : object,
    ),
  };
}
