import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkerDitherPaintMode, solidPaintMode } from "../domain/paintSources";
import { indexFor } from "../domain/pixelOps";
import { BLACK_PIXEL } from "../domain/types";
import type { PlaydateProjectDocument, ProjectSummary } from "../persistence/projectSchema";
import { currentActivePixelLayer, useEditorStore } from "./editorStore";

const projectDbMock = vi.hoisted(() => ({
  deleteProjectDocument: vi.fn(),
  listProjectSummaries: vi.fn(),
  loadProjectDocument: vi.fn(),
  saveProjectDocument: vi.fn(),
}));

vi.mock("../persistence/projectDb", () => projectDbMock);

describe("editor store saveProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("keeps newer edits dirty when an older save resolves", async () => {
    let resolveSave: () => void = () => {};
    projectDbMock.saveProjectDocument.mockImplementation(
      (document: PlaydateProjectDocument) =>
        new Promise<ProjectSummary>((resolve) => {
          resolveSave = () => resolve({ id: document.id, name: document.name, updatedAt: document.updatedAt });
        }),
    );

    useEditorStore.setState({
      hasUnsavedChanges: true,
      projectName: "Before save",
      documentRevision: 3,
      status: "Ready",
    });

    const savePromise = useEditorStore.getState().saveProject();
    useEditorStore.setState({
      hasUnsavedChanges: true,
      projectName: "Newer edit",
      documentRevision: 4,
      status: "Newer edit pending",
    });

    resolveSave();
    await savePromise;

    const state = useEditorStore.getState();
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.projectName).toBe("Newer edit");
    expect(state.savedDocumentRevision).toBe(3);
    expect(state.status).toBe("Newer edit pending");
    expect(state.currentProjectId).not.toBeNull();
  });

  it("marks the project clean when no newer edits happen during save", async () => {
    projectDbMock.saveProjectDocument.mockImplementation((document: PlaydateProjectDocument) =>
      Promise.resolve({
        id: document.id,
        name: document.name,
        updatedAt: document.updatedAt,
      }),
    );

    useEditorStore.setState({
      hasUnsavedChanges: true,
      projectName: "Saved project",
      documentRevision: 5,
      status: "Dirty",
    });

    await useEditorStore.getState().saveProject();

    const state = useEditorStore.getState();
    expect(state.hasUnsavedChanges).toBe(false);
    expect(state.savedDocumentRevision).toBe(5);
    expect(state.status).toBe("Project saved locally");
  });
});

describe("editor store revision semantics", () => {
  beforeEach(() => {
    resetStore();
  });

  it("increments document and view revisions for document changes", () => {
    const state = useEditorStore.getState();

    state.markDocumentChanged();

    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().viewRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it("increments only view revision for shape previews", () => {
    const state = useEditorStore.getState();

    state.setShapePreview({
      brushSize: 1,
      end: { x: 4, y: 4 },
      mirrorX: false,
      mirrorY: false,
      start: { x: 2, y: 2 },
      type: "line",
    });

    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("increments only view revision for grid changes", () => {
    const state = useEditorStore.getState();

    state.setGridVisible(true);
    state.setGridSize(8);

    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(2);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("does not revise document or view for tool, cursor, and zoom changes", () => {
    const state = useEditorStore.getState();

    state.setTool("eraser");
    state.setCursorLabel("x: 1 y: 2");
    state.setZoom(4);

    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("tracks paint mode separately from the active tool", () => {
    const state = useEditorStore.getState();

    state.setTool("fill");
    state.setPaintMode(checkerDitherPaintMode({ foreground: BLACK_PIXEL }));

    expect(useEditorStore.getState().activeTool).toBe("fill");
    expect(useEditorStore.getState().activePaintMode).toMatchObject({ type: "checker-dither" });
  });
});

describe("editor store pending commands", () => {
  beforeEach(() => {
    resetStore();
  });

  it("clears no-op commands without adding undo history", () => {
    const state = useEditorStore.getState();

    state.beginCommand("No-op fill");
    state.commitCommand("No-op fill");

    expect(useEditorStore.getState().pendingCommand).toBeNull();
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("can explicitly discard pending commands on exceptional exits", () => {
    const state = useEditorStore.getState();

    state.beginCommand("Interrupted stroke");
    state.discardPendingCommand();

    expect(useEditorStore.getState().pendingCommand).toBeNull();
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("adds exactly one undo command for a changed stroke", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");

    state.beginCommand("Draw stroke");
    layer.surface.data[0] = BLACK_PIXEL;
    state.markDocumentChanged();
    state.commitCommand("Draw stroke");

    expect(useEditorStore.getState().pendingCommand).toBeNull();
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("defers brush stroke document revision until the gesture finishes", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    const contentRevision = layer.contentRevision;

    state.beginCommand("Draw stroke");
    layer.surface.data[indexFor(0, 0, layer.surface.width)] = BLACK_PIXEL;
    layer.surface.data[indexFor(1, 0, layer.surface.width)] = BLACK_PIXEL;

    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);

    state.markDocumentChanged();
    state.commitCommand("Draw stroke");

    const changedLayer = currentActivePixelLayer();
    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().viewRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(changedLayer?.contentRevision).toBe(contentRevision + 1);
  });

  it("keeps no-op brush gestures out of document revisions and undo history", () => {
    const state = useEditorStore.getState();

    state.beginCommand("Draw stroke");
    state.commitCommand("Draw stroke");

    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().pendingCommand).toBeNull();
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });
});

function resetStore(): void {
  useEditorStore.getState().newProject();
  useEditorStore.setState({
    canRedo: false,
    canUndo: false,
    currentProjectId: null,
    hasUnsavedChanges: false,
    pendingCommand: null,
    projectName: "Untitled Playdate Art",
    recentProjects: [],
    redoStack: [],
    documentRevision: 0,
    activePaintMode: solidPaintMode(BLACK_PIXEL),
    activePaintValue: BLACK_PIXEL,
    savedDocumentRevision: 0,
    status: "Ready",
    undoStack: [],
    viewRevision: 0,
  });
}
