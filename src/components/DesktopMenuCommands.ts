import type { DesktopMenuCommand } from "../desktop/desktopApi";
import { isDesktopMenuCommandBlockedDuringGesture } from "../input/gestureShortcutGuards";
import { useEditorStore } from "../state/editorStore";

export function executeDesktopMenuCommand(command: DesktopMenuCommand): void {
  const state = useEditorStore.getState();
  const nativeEditRole = nativeEditRoleForCommand(command);

  if (nativeEditRole && performNativeEditWhenTextEditing(nativeEditRole)) return;
  if (state.gestureActive && isDesktopMenuCommandBlockedDuringGesture(command)) return;

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
    case "project:import-image":
      void state.openImageImportFile();
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
      void state.copySelection();
      break;
    case "edit:cut":
      void state.cutSelection();
      break;
    case "edit:paste":
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

function nativeEditRoleForCommand(command: DesktopMenuCommand): "copy" | "cut" | "paste" | null {
  if (command.id === "edit:copy") return "copy";
  if (command.id === "edit:cut") return "cut";
  if (command.id === "edit:paste") return "paste";
  return null;
}

function performNativeEditWhenTextEditing(role: "copy" | "cut" | "paste"): boolean {
  if (!isTextEditingTarget(document.activeElement)) return false;
  void window.pdps?.menu.performNativeEdit(role);
  return true;
}

function isTextEditingTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable;
}
