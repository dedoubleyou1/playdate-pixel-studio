import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../state/editorStore";
import { executeDesktopMenuCommand } from "./DesktopMenuCommands";

const originalActions = {
  clearActiveLayer: useEditorStore.getState().clearActiveLayer,
  invertActiveLayer: useEditorStore.getState().invertActiveLayer,
  loadProject: useEditorStore.getState().loadProject,
  newProject: useEditorStore.getState().newProject,
  openImageImportFile: useEditorStore.getState().openImageImportFile,
  saveProject: useEditorStore.getState().saveProject,
  setGridVisible: useEditorStore.getState().setGridVisible,
  undo: useEditorStore.getState().undo,
};

describe("desktop menu gesture gating", () => {
  const clearActiveLayer = vi.fn();
  const invertActiveLayer = vi.fn();
  const loadProject = vi.fn(() => Promise.resolve());
  const newProject = vi.fn();
  const openImageImportFile = vi.fn(() => Promise.resolve());
  const saveProject = vi.fn(() => Promise.resolve());
  const setGridVisible = vi.fn();
  const undo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({
      clearActiveLayer,
      gestureActive: true,
      invertActiveLayer,
      loadProject,
      newProject,
      openImageImportFile,
      saveProject,
      setGridVisible,
      undo,
    });
  });

  afterEach(() => {
    useEditorStore.setState({ ...originalActions, gestureActive: false });
  });

  it("ignores document-conflicting native menu commands during a gesture", () => {
    executeDesktopMenuCommand({ id: "project:new" });
    executeDesktopMenuCommand({ id: "project:save" });
    executeDesktopMenuCommand({ id: "project:open-recent", projectId: "project-1" });
    executeDesktopMenuCommand({ id: "project:import-image" });
    executeDesktopMenuCommand({ id: "edit:undo" });
    executeDesktopMenuCommand({ id: "edit:clear-layer" });
    executeDesktopMenuCommand({ id: "edit:invert-layer" });

    expect(newProject).not.toHaveBeenCalled();
    expect(saveProject).not.toHaveBeenCalled();
    expect(loadProject).not.toHaveBeenCalled();
    expect(openImageImportFile).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();
    expect(clearActiveLayer).not.toHaveBeenCalled();
    expect(invertActiveLayer).not.toHaveBeenCalled();
  });

  it("still executes view-only native menu commands during a gesture", () => {
    executeDesktopMenuCommand({ id: "view:toggle-grid" });

    expect(setGridVisible).toHaveBeenCalledWith(!useEditorStore.getState().gridVisible);
  });

  it("executes document commands after the gesture finishes", () => {
    useEditorStore.setState({ gestureActive: false });

    executeDesktopMenuCommand({ id: "edit:undo" });

    expect(undo).toHaveBeenCalledOnce();
  });

  it("opens image import after the gesture finishes", () => {
    useEditorStore.setState({ gestureActive: false });

    executeDesktopMenuCommand({ id: "project:import-image" });

    expect(openImageImportFile).toHaveBeenCalledOnce();
  });
});
