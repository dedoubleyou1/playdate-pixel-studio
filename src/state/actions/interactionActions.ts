import { activeLayer, isPixelEditableLayer } from "../../domain/layers";
import { paletteEntryLabel } from "../../domain/palette";
import { TOOL_LABELS } from "../editorStoreHelpers";
import type { EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

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
  | "setPreviewMode"
  | "setEditTarget"
  | "openPreview"
  | "closePreview"
>;

export function createInteractionActions(set: EditorStoreSet): InteractionActions {
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

    openPreview: () => set({ previewOpen: true }),
    closePreview: () => set({ previewOpen: false }),
  };
}
