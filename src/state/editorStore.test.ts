import { beforeEach, describe, expect, it, vi } from "vitest";
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
      revision: 3,
      status: "Ready",
    });

    const savePromise = useEditorStore.getState().saveProject();
    useEditorStore.setState({
      hasUnsavedChanges: true,
      projectName: "Newer edit",
      revision: 4,
      status: "Newer edit pending",
    });

    resolveSave();
    await savePromise;

    const state = useEditorStore.getState();
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.projectName).toBe("Newer edit");
    expect(state.savedRevision).toBe(3);
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
      revision: 5,
      status: "Dirty",
    });

    await useEditorStore.getState().saveProject();

    const state = useEditorStore.getState();
    expect(state.hasUnsavedChanges).toBe(false);
    expect(state.savedRevision).toBe(5);
    expect(state.status).toBe("Project saved locally");
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
    revision: 0,
    savedRevision: 0,
    status: "Ready",
    undoStack: [],
  });
}
