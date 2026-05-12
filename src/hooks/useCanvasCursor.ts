import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import type { SelectionCombineMode, Tool } from "../domain/types";
import { useEditorStore } from "../state/editorStore";
import { toolCursor } from "../toolCursors";

export interface CanvasCursorState {
  activeSelectionCombineMode: SelectionCombineMode | null;
  activeTool: Tool;
  drawingEnabled: boolean;
  hasActiveLayer: boolean;
  hoverSelectionCombineMode: SelectionCombineMode | null;
  maskEditingEnabled: boolean;
}

export function useCanvasCursor(hoverSelectionCombineMode: SelectionCombineMode | null): string {
  return useEditorStore((state) => {
    const layer = activeLayer(state);
    return deriveCanvasCursor({
      activeSelectionCombineMode: state.activeSelectionCombineMode,
      activeTool: state.activeTool,
      drawingEnabled: isPixelEditableLayer(layer),
      hasActiveLayer: Boolean(layer),
      hoverSelectionCombineMode,
      maskEditingEnabled: state.editTarget === "alphaMask" && Boolean(layer),
    });
  });
}

export function deriveCanvasCursor({
  activeSelectionCombineMode,
  activeTool,
  drawingEnabled,
  hasActiveLayer,
  hoverSelectionCombineMode,
  maskEditingEnabled,
}: CanvasCursorState): string {
  if (activeTool === "marquee" || activeTool === "ellipseSelect") {
    return toolCursor(activeTool, activeSelectionCombineMode ?? hoverSelectionCombineMode);
  }

  if (activeTool === "move") {
    return hasActiveLayer ? toolCursor(activeTool) : "not-allowed";
  }

  return drawingEnabled || maskEditingEnabled ? toolCursor(activeTool) : "not-allowed";
}
