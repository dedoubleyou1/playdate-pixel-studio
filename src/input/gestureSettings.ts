import type { MaskToolSettings } from "../domain/maskCommands";
import type { PixelToolSettings } from "../domain/pixelCommands";
import type { Tool } from "../domain/types";
import { currentSelection, useEditorStore } from "../state/editorStore";

export function pixelToolSettings(): PixelToolSettings {
  const state = useEditorStore.getState();
  return {
    brushSize: state.brushSize,
    brushShape: state.brushShape,
    mirrorX: state.mirrorX,
    mirrorY: state.mirrorY,
    paletteIndex: state.activePaletteIndex,
    selectionMask: currentSelection()?.mask ?? null,
  };
}

export function maskToolSettings(tool: Tool): MaskToolSettings {
  const state = useEditorStore.getState();
  return {
    brushSize: state.brushSize,
    brushShape: state.brushShape,
    mirrorX: state.mirrorX,
    mirrorY: state.mirrorY,
    value: tool === "eraser" ? 0 : 1,
  };
}
