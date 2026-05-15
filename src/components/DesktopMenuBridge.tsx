import { useEffect } from "react";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import type { DesktopMenuCommand } from "../desktop/desktopApi";
import { hasActiveSelection, useEditorStore } from "../state/editorStore";

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

function executeDesktopMenuCommand(command: DesktopMenuCommand): void {
  const state = useEditorStore.getState();

  switch (command.id) {
    case "project:new":
      state.newProject();
      break;
    case "project:save":
      void state.saveProject();
      break;
    case "project:open-recent":
      if (command.projectId) void state.loadProject(command.projectId);
      break;
    case "project:import":
      void state.openProjectFile();
      break;
    case "project:export-png":
      void state.exportPng();
      break;
    case "project:export-json":
      void state.exportProjectFile();
      break;
    case "project:export-bundle":
      void state.exportBundle();
      break;
    case "edit:undo":
      state.undo();
      break;
    case "edit:redo":
      state.redo();
      break;
    case "edit:copy":
      if (performNativeEditWhenTextEditing("copy")) break;
      void state.copySelection();
      break;
    case "edit:cut":
      if (performNativeEditWhenTextEditing("cut")) break;
      void state.cutSelection();
      break;
    case "edit:paste":
      if (performNativeEditWhenTextEditing("paste")) break;
      void state.pasteClipboard();
      break;
    case "edit:clear-selection":
      state.clearSelection();
      break;
    case "edit:clear-layer":
      state.clearActiveLayer();
      break;
    case "edit:invert-layer":
      state.invertActiveLayer();
      break;
    case "view:toggle-grid":
      state.setGridVisible(!state.gridVisible);
      break;
    case "view:toggle-colorized-patterns":
      state.setColorizedPatternsVisible(!state.colorizedPatternsVisible);
      break;
    case "view:set-grid-size":
      if (typeof command.gridSize === "number") state.setGridSize(command.gridSize);
      break;
  }
}

function performNativeEditWhenTextEditing(role: "copy" | "cut" | "paste"): boolean {
  if (!isTextEditingTarget(document.activeElement)) return false;
  void window.pdps?.menu.performNativeEdit(role);
  return true;
}

function isTextEditingTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target.isContentEditable;
}
