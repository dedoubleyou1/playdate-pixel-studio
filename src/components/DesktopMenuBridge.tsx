import { useEffect } from "react";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { hasActiveSelection, useEditorStore } from "../state/editorStore";
import { executeDesktopMenuCommand } from "./DesktopMenuCommands";

export function DesktopMenuBridge(): null {
  const activeLayerPixelEditable = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));
  const canRedo = useEditorStore((state) => state.canRedo);
  const canUndo = useEditorStore((state) => state.canUndo);
  const colorizedPatternsVisible = useEditorStore((state) => state.colorizedPatternsVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const hasSelection = useEditorStore(hasActiveSelection);
  const hasUnsavedChanges = useEditorStore((state) => state.hasUnsavedChanges);
  const recentProjects = useEditorStore((state) => state.recentProjects);

  useEffect(() => {
    return window.pdps?.menu.onCommand((command) => {
      executeDesktopMenuCommand(command);
    });
  }, []);

  useEffect(() => {
    void window.pdps?.menu.setState({
      activeLayerPixelEditable,
      canRedo,
      canUndo,
      colorizedPatternsVisible,
      gridSize,
      gridVisible,
      hasSelection,
      hasUnsavedChanges,
      recentProjects: recentProjects.map((project) => ({ id: project.id, name: project.name })),
    });
  }, [
    activeLayerPixelEditable,
    canRedo,
    canUndo,
    colorizedPatternsVisible,
    gridSize,
    gridVisible,
    hasSelection,
    hasUnsavedChanges,
    recentProjects,
  ]);

  return null;
}
