import { createEditorCommand } from "../../domain/commands";
import { activeLayer, activeStack, isPixelEditableLayer } from "../../domain/layers";
import {
  combineBinaryMaskSurface,
  createEllipseMask,
  createRectMask,
  createSelectionStateFromMask,
} from "../../domain/masks";
import { paletteEntryLabel } from "../../domain/palette";
import type { SelectionCombineMode } from "../../domain/types";
import {
  activeSelection,
  pushCommand,
  selectionCommandLabel,
  selectionSnapshot,
  selectionStatus,
  setActiveSelectionState,
  snapshotFrom,
  TOOL_LABELS,
  type MaskFactory,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type InteractionActions = Pick<
  EditorStoreState,
  | "setTool"
  | "setActivePaletteIndex"
  | "setBrushSize"
  | "setBrushShape"
  | "setMirrorX"
  | "setMirrorY"
  | "setGridVisible"
  | "setGridSize"
  | "setColorizedPatternsVisible"
  | "setZoom"
  | "setStatus"
  | "setCursorLabel"
  | "setCanvasToolPreview"
  | "setActiveSelectionCombineMode"
  | "setPreviewMode"
  | "setEditTarget"
  | "setSelectionFromRect"
  | "setSelectionFromEllipse"
  | "clearSelection"
  | "openPreview"
  | "closePreview"
>;

export function createInteractionActions(set: EditorStoreSet, get: EditorStoreGet): InteractionActions {
  const setSelectionFromMask = (
    label: string,
    status: string,
    mode: SelectionCombineMode,
    createMask: MaskFactory,
  ): void => {
    const before = snapshotFrom(get());
    const beforeSelection = selectionSnapshot(get());
    set((state) => {
      const stack = activeStack(state);
      const combinedMask = combineBinaryMaskSurface(activeSelection(state)?.mask, createMask(stack.width, stack.height), mode);
      const selection = createSelectionStateFromMask(combinedMask);
      return setActiveSelectionState(state, selection.isEmpty ? null : selection, status);
    });
    const afterSelection = selectionSnapshot(get());
    pushCommand(
      set,
      createEditorCommand(label, before, snapshotFrom(get()), {
        afterSelection,
        beforeSelection,
      }),
    );
  };

  return {
    setTool: (tool) =>
      set((state) => {
        const layer = activeLayer(state);
        const toolAllowed =
          tool === "marquee" ||
          tool === "ellipseSelect" ||
          (tool === "move" && Boolean(layer)) ||
          (state.editTarget === "alphaMask" && Boolean(layer)) ||
          isPixelEditableLayer(layer);

        if (!toolAllowed) {
          return { status: "Active layer does not support pixel drawing" };
        }

        return {
          activeTool: tool,
          status: `${TOOL_LABELS[tool]} ready`,
        };
      }),

    setActivePaletteIndex: (activePaletteIndex) =>
      set((state) => ({
        activePaletteIndex,
        status: `${paletteEntryLabel(state.palette, activePaletteIndex)} selected`,
      })),

    setBrushSize: (brushSize) => set({ brushSize }),
    setBrushShape: (brushShape) => set({ brushShape }),
    setMirrorX: (mirrorX) => set({ mirrorX }),
    setMirrorY: (mirrorY) => set({ mirrorY }),

    setGridVisible: (gridVisible) =>
      set((state) => (state.gridVisible === gridVisible ? {} : { gridVisible, viewRevision: state.viewRevision + 1 })),

    setGridSize: (gridSize) =>
      set((state) => (state.gridSize === gridSize ? {} : { gridSize, viewRevision: state.viewRevision + 1 })),

    setColorizedPatternsVisible: (colorizedPatternsVisible) =>
      set((state) =>
        state.colorizedPatternsVisible === colorizedPatternsVisible
          ? {}
          : { colorizedPatternsVisible, viewRevision: state.viewRevision + 1 },
      ),

    setZoom: (zoom) => set({ zoom }),
    setStatus: (status) => set({ status }),
    setCursorLabel: (cursorLabel) => set({ cursorLabel }),

    setPreviewMode: (previewMode) =>
      set((state) => (state.previewMode === previewMode ? {} : { previewMode, viewRevision: state.viewRevision + 1 })),

    setCanvasToolPreview: (canvasToolPreview) =>
      set((state) => ({ canvasToolPreview, viewRevision: state.viewRevision + 1 })),

    setActiveSelectionCombineMode: (activeSelectionCombineMode) => set({ activeSelectionCombineMode }),

    setEditTarget: (editTarget) =>
      set((state) =>
        state.editTarget === editTarget
          ? {}
          : {
              editTarget,
              activeTool: editTarget === "alphaMask" && state.activeTool === "move" ? "pencil" : state.activeTool,
              status: editTarget === "alphaMask" ? "Editing alpha mask" : "Editing pixels",
              viewRevision: state.viewRevision + 1,
            },
      ),

    setSelectionFromRect: (start, end, mode = "replace") => {
      setSelectionFromMask(selectionCommandLabel(mode, "selection"), selectionStatus(mode), mode, (width, height) =>
        createRectMask(width, height, start, end),
      );
    },

    setSelectionFromEllipse: (start, end, mode = "replace") => {
      setSelectionFromMask(selectionCommandLabel(mode, "ellipse selection"), selectionStatus(mode), mode, (width, height) =>
        createEllipseMask(width, height, start, end),
      );
    },

    clearSelection: () => {
      const before = snapshotFrom(get());
      const beforeSelection = selectionSnapshot(get());
      set((state) => (activeSelection(state) ? setActiveSelectionState(state, null, "Selection cleared") : {}));
      pushCommand(
        set,
        createEditorCommand("Clear selection", before, snapshotFrom(get()), {
          afterSelection: selectionSnapshot(get()),
          beforeSelection,
        }),
      );
    },

    openPreview: () => set({ previewOpen: true }),
    closePreview: () => set({ previewOpen: false }),
  };
}
