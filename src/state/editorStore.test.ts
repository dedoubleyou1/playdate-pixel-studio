import { beforeEach, describe, expect, it, vi } from "vitest";
import { EDITOR_CLIPBOARD_KIND, EDITOR_CLIPBOARD_SCHEMA_VERSION, type EditorClipboard } from "../domain/clipboard";
import { createObjectDefinition, createObjectInstanceLayer, createSurface } from "../domain/layers";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL, type PatternPaletteEntry } from "../domain/types";
import { beginAlphaMaskGesture, ensureDraftActiveLayerAlphaMask, finishAlphaMaskGesture } from "../input/alphaMaskGestures";
import { beginGestureTransaction } from "../input/gestureTransaction";
import { parseEditorClipboardJson, serializeEditorClipboard } from "../persistence/clipboardSchema";
import type { PlaydateProjectDocument, ProjectSummary } from "../persistence/projectSchema";
import {
  currentActiveLayer,
  currentActivePixelLayer,
  effectiveColorizedPatternsVisible,
  hasActiveSelection,
  useEditorStore,
} from "./editorStore";

const projectDbMock = vi.hoisted(() => ({
  deleteProjectDocument: vi.fn(),
  listProjectSummaries: vi.fn(),
  loadProjectDocument: vi.fn(),
  saveProjectDocument: vi.fn(),
}));

const desktopApiMock = vi.hoisted(() => ({
  openProjectFileWithDesktopDialog: vi.fn(),
  readSelectionFromDesktopClipboard: vi.fn(),
  saveBlobWithDesktopDialog: vi.fn(),
  writeSelectionToDesktopClipboard: vi.fn(),
}));

vi.mock("../persistence/projectDb", () => projectDbMock);
vi.mock("../desktop/desktopApi", () => desktopApiMock);

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

  it("increments only view revision for canvas tool previews", () => {
    const state = useEditorStore.getState();

    state.setCanvasToolPreview({
      brushSize: 1,
      brushShape: "square",
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

  it("increments only view revision for colorized pattern visualization", () => {
    const state = useEditorStore.getState();

    state.setColorizedPatternsVisible(true);

    expect(useEditorStore.getState().colorizedPatternsVisible).toBe(true);
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("increments only view revision for temporary colorized pattern inversion", () => {
    const state = useEditorStore.getState();

    expect(effectiveColorizedPatternsVisible(state)).toBe(false);

    state.setColorizedPatternsModifierActive(true);

    expect(useEditorStore.getState().colorizedPatternsModifierActive).toBe(true);
    expect(effectiveColorizedPatternsVisible(useEditorStore.getState())).toBe(true);
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().setColorizedPatternsVisible(true);
    expect(effectiveColorizedPatternsVisible(useEditorStore.getState())).toBe(false);
  });

  it("increments only view revision when switching edit contexts", () => {
    const object = createObjectDefinition("object-1", "Object 1", 8, 8);
    useEditorStore.setState({ objects: [object], viewRevision: 4 });

    useEditorStore.getState().switchToObject(object.id);
    expect(useEditorStore.getState().activeContext).toEqual({ type: "object", objectId: object.id });
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(5);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().switchToRoot();
    expect(useEditorStore.getState().activeContext).toEqual({ type: "root" });
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(6);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().switchToRoot();
    expect(useEditorStore.getState().viewRevision).toBe(6);
  });

  it("duplicates object definitions with cloned layer data", () => {
    const object = createObjectDefinition("object-1", "Object 1", 8, 8);
    object.layers[0].surface.data[indexFor(2, 3, object.width)] = BLACK_PIXEL;
    useEditorStore.setState({ objects: [object], viewRevision: 4 });

    useEditorStore.getState().duplicateObject(object.id);

    const state = useEditorStore.getState();
    expect(state.objects).toHaveLength(2);
    expect(state.objects[1]).toMatchObject({ name: "Object 1 Copy", width: 8, height: 8 });
    expect(state.objects[1].id).not.toBe(object.id);
    expect(state.objects[1].layers[0].surface.data[indexFor(2, 3, object.width)]).toBe(BLACK_PIXEL);
    expect(state.objects[1].layers[0].surface.data).not.toBe(object.layers[0].surface.data);
    expect(state.activeContext).toEqual({ type: "object", objectId: state.objects[1].id });
    expect(state.documentRevision).toBe(1);
    expect(state.viewRevision).toBe(5);
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.undoStack).toHaveLength(1);
  });

  it("removes object definitions and their root instances", () => {
    const object = createObjectDefinition("object-1", "Object 1", 8, 8);
    const instance = createObjectInstanceLayer(2, object.name, object.id);
    useEditorStore.setState((state) => ({
      activeContext: { type: "object", objectId: object.id },
      objects: [object],
      root: {
        ...state.root,
        activeLayerIndex: 1,
        layers: [state.root.layers[0], instance],
        nextLayerId: 3,
      },
      viewRevision: 4,
    }));

    useEditorStore.getState().deleteObject(object.id);

    const state = useEditorStore.getState();
    expect(state.objects).toHaveLength(0);
    expect(state.root.layers).toHaveLength(1);
    expect(state.root.layers.some((layer) => layer.type === "object" && layer.objectId === object.id)).toBe(false);
    expect(state.root.activeLayerIndex).toBe(0);
    expect(state.activeContext).toEqual({ type: "root" });
    expect(state.documentRevision).toBe(1);
    expect(state.viewRevision).toBe(5);
    expect(state.hasUnsavedChanges).toBe(true);
    expect(state.undoStack).toHaveLength(1);
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

  it("tracks palette selection separately from the active tool", () => {
    const state = useEditorStore.getState();

    state.setTool("fill");
    state.setActiveSwatchRef(3);

    expect(useEditorStore.getState().activeTool).toBe("fill");
    expect(useEditorStore.getState().activeSwatchRef).toBe(3);
  });

  it("adds, edits, duplicates, and undoes pattern swatches", () => {
    const state = useEditorStore.getState();

    state.addPatternSwatch("hatch-vertical-1", { offsetX: 2, offsetY: 1, reflectX: false, reflectY: true, rotation: 90 });
    let current = useEditorStore.getState();
    const added = current.palette.entries.find(
      (entry): entry is PatternPaletteEntry => entry.type === "pattern" && entry.patternId === "hatch-vertical-1",
    );
    expect(added).toMatchObject({ offsetX: 2, offsetY: 1, reflectY: true, rotation: 90 });
    expect(current.activeSwatchRef).toBe(added?.ref);

    if (!added) throw new Error("Expected added swatch");
    current.updatePatternSwatch(added.ref, { offsetX: 5, patternId: "hatch-diagonal-2" });
    expect(useEditorStore.getState().palette.entries.find((entry) => entry.ref === added.ref)).toMatchObject({
      offsetX: 5,
      patternId: "hatch-diagonal-2",
      previewHue: added.previewHue,
    });

    useEditorStore.getState().duplicatePatternSwatch(added.ref);
    current = useEditorStore.getState();
    const diagonalSwatches = current.palette.entries.filter(
      (entry): entry is PatternPaletteEntry => entry.type === "pattern" && entry.patternId === "hatch-diagonal-2",
    );
    expect(diagonalSwatches).toHaveLength(2);
    expect(diagonalSwatches[0].previewHue).not.toBe(diagonalSwatches[1].previewHue);
    expect(current.undoStack).toHaveLength(3);

    current.undo();
    expect(useEditorStore.getState().palette.entries.filter((entry) => entry.type === "pattern" && entry.patternId === "hatch-diagonal-2")).toHaveLength(1);
  });

  it("rasterizes used pixels before deleting a pattern swatch", () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(0, 0, layer.surface.width)] = 4;
    useEditorStore.setState({ activeSwatchRef: 4 });

    useEditorStore.getState().deletePatternSwatch(4);

    const state = useEditorStore.getState();
    const currentLayer = currentActivePixelLayer();
    expect(confirm).toHaveBeenCalled();
    expect(currentLayer?.surface.data[indexFor(0, 0, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(state.palette.entries.some((entry) => entry.ref === 4)).toBe(false);
    expect(state.activeSwatchRef).toBe(3);
    expect(state.undoStack.at(-1)?.label).toBe("Delete pattern swatch");
  });

  it("can cancel deletion when a pattern swatch is used", () => {
    vi.stubGlobal("window", { confirm: vi.fn(() => false) });
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(0, 0, layer.surface.width)] = 4;

    useEditorStore.getState().deletePatternSwatch(4);

    expect(useEditorStore.getState().palette.entries.some((entry) => entry.ref === 4)).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
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

describe("editor store layer move gestures", () => {
  beforeEach(() => {
    resetStore();
  });

  it("keeps selected pixel layer move previews out of document state until commit", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;

    expect(state.beginMoveLayer()).toBe(true);
    expect(useEditorStore.getState().pendingSelectionMove).toMatchObject({ implicitFullLayer: true });
    expect(useEditorStore.getState().pendingMove).toBeNull();

    const pendingLayer = currentActivePixelLayer();
    expect(pendingLayer?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(pendingLayer?.surface.data[indexFor(3, 2, layer.surface.width)]).toBe(0);
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);

    expect(state.commitMoveLayer(2, 1)).toBe(true);

    const movedLayer = currentActivePixelLayer();
    expect(movedLayer?.surface.data[indexFor(3, 2, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().rootSelection).toBeNull();

    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().viewRevision).toBe(1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("translates alpha masks with implicit full pixel layer moves", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    layer.alphaMask = createBinaryMaskSurface(layer.surface.width, layer.surface.height);
    layer.alphaMask.data[indexFor(1, 1, layer.surface.width)] = 1;

    expect(state.beginMoveLayer()).toBe(true);
    expect(state.commitMoveLayer(2, 0)).toBe(true);

    const movedLayer = currentActivePixelLayer();
    expect(movedLayer?.surface.data[indexFor(3, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(movedLayer?.alphaMask?.data[indexFor(1, 1, layer.surface.width)]).toBe(0);
    expect(movedLayer?.alphaMask?.data[indexFor(3, 1, layer.surface.width)]).toBe(1);
  });

  it("keeps no-op selected layer moves out of document revisions and undo history", () => {
    const state = useEditorStore.getState();

    expect(state.beginMoveLayer()).toBe(true);
    expect(state.commitMoveLayer(0, 0)).toBe(false);

    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().viewRevision).toBe(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useEditorStore.getState().pendingMove).toBeNull();
  });

  it("cancels selected pixel layer moves by restoring the original layer", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;

    state.beginMoveLayer();
    state.cancelMoveLayer();

    const restoredLayer = currentActivePixelLayer();
    expect(restoredLayer?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(restoredLayer?.surface.data[indexFor(3, 1, layer.surface.width)]).toBe(0);
    expect(useEditorStore.getState().rootSelection).toBeNull();
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("moves selected object instance layers without changing the source object", () => {
    const object = createObjectDefinition("object-1", "Object 1", 8, 8);
    const instance = createObjectInstanceLayer(2, "Object 1", object.id);
    instance.x = 4;
    instance.y = 5;

    useEditorStore.setState((state) => ({
      objects: [object],
      root: {
        ...state.root,
        activeLayerIndex: 1,
        layers: [state.root.layers[0], instance],
      },
    }));

    const state = useEditorStore.getState();
    expect(state.beginMoveLayer()).toBe(true);

    const pendingLayer = currentActiveLayer();
    expect(pendingLayer).toMatchObject({ type: "object", x: 4, y: 5 });
    expect(useEditorStore.getState().objects[0]).toBe(object);

    expect(state.commitMoveLayer(3, -2)).toBe(true);

    const movedLayer = currentActiveLayer();
    expect(movedLayer).toMatchObject({ type: "object", x: 7, y: 3 });

    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("lifts and moves selected pixels while moving the selection mask", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 1, y: 1 });

    expect(state.beginMoveLayer()).toBe(true);
    expect(useEditorStore.getState().pendingSelectionMove).not.toBeNull();
    expect(state.commitMoveLayer(2, 0)).toBe(true);

    const movedLayer = currentActivePixelLayer();
    expect(movedLayer?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(0);
    expect(movedLayer?.surface.data[indexFor(3, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(3, 1, layer.surface.width)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 3, top: 1, right: 3, bottom: 1 });
    expect(useEditorStore.getState().undoStack).toHaveLength(2);
  });

  it("restores selected-pixel move selections on undo and redo", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 1, y: 1 });

    state.beginMoveLayer();
    state.commitMoveLayer(2, 0);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(3, 1, layer.surface.width)]).toBe(1);

    useEditorStore.getState().undo();
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1, layer.surface.width)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(3, 1, layer.surface.width)]).toBe(0);

    useEditorStore.getState().redo();
    expect(currentActivePixelLayer()?.surface.data[indexFor(3, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1, layer.surface.width)]).toBe(0);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(3, 1, layer.surface.width)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 3, top: 1, right: 3, bottom: 1 });
  });
});

describe("editor store selection and alpha masks", () => {
  beforeEach(() => {
    resetStore();
  });

  it("undoes and redoes selection creation without dirtying the document", () => {
    const state = useEditorStore.getState();

    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 2, y: 2 });
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.isEmpty).toBe(false);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().rootSelection).toBeNull();
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(2, 2)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("reads active-selection presence from cached metadata", () => {
    const mask = createBinaryMaskSurface(2, 2);

    expect(
      hasActiveSelection({
        activeContext: { type: "root" },
        objectSelection: null,
        rootSelection: {
          bounds: { left: 0, top: 0, right: 0, bottom: 0 },
          isEmpty: false,
          mask,
        },
      }),
    ).toBe(true);
  });

  it("copies selected pixels to the desktop clipboard without dirtying the document", async () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    layer.surface.data[indexFor(2, 1, layer.surface.width)] = WHITE_PIXEL;
    layer.surface.data[indexFor(2, 2, layer.surface.width)] = BLACK_PIXEL;
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 2, y: 2 });
    state.setSelectionFromRect({ x: 2, y: 2 }, { x: 2, y: 2 }, "subtract");
    const undoCount = useEditorStore.getState().undoStack.length;

    await expect(state.copySelection()).resolves.toBe(true);

    const json = desktopApiMock.writeSelectionToDesktopClipboard.mock.calls[0]?.[0] as string;
    const clipboard = parseEditorClipboardJson(json);
    expect(clipboard?.origin).toEqual({ x: 1, y: 1 });
    expect(clipboard?.surface.width).toBe(2);
    expect(clipboard?.surface.height).toBe(2);
    expect(Array.from(clipboard?.surface.data ?? [])).toEqual([BLACK_PIXEL, WHITE_PIXEL, TRANSPARENT_PIXEL, TRANSPARENT_PIXEL]);
    expect(Array.from(clipboard?.mask.data ?? [])).toEqual([1, 1, 1, 0]);
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().undoStack).toHaveLength(undoCount);
  });

  it("cuts selected pixels after the desktop clipboard write succeeds", async () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    const initialContentRevision = layer.contentRevision;
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 1, y: 1 });

    await expect(state.cutSelection()).resolves.toBe(true);

    expect(desktopApiMock.writeSelectionToDesktopClipboard).toHaveBeenCalledOnce();
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(TRANSPARENT_PIXEL);
    expect(currentActivePixelLayer()?.contentRevision).toBe(initialContentRevision + 1);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);
    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);
  });

  it("does not cut pixels if selection changes while the desktop clipboard write is pending", async () => {
    let resolveClipboardWrite: () => void = () => undefined;
    desktopApiMock.writeSelectionToDesktopClipboard.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveClipboardWrite = () => resolve(true);
      }),
    );
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 1, y: 1 });

    const cutPromise = state.cutSelection();
    state.clearSelection();
    resolveClipboardWrite();

    await expect(cutPromise).resolves.toBe(false);
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().undoStack.map((command) => command.label)).not.toContain("Cut selection");
    expect(useEditorStore.getState().status).toBe("Selection changed before cut");
  });

  it("does not mutate the document when cut cannot write the desktop clipboard", async () => {
    desktopApiMock.writeSelectionToDesktopClipboard.mockRejectedValue(new Error("No clipboard"));
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 1, y: 1 });
    const undoCount = useEditorStore.getState().undoStack.length;

    await expect(state.cutSelection()).resolves.toBe(false);

    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
    expect(useEditorStore.getState().undoStack).toHaveLength(undoCount);
  });

  it("pastes clipboard pixels using transparent-skip stamp semantics", async () => {
    const mask = createBinaryMaskSurface(2, 2, true);
    const clipboard: EditorClipboard = {
      kind: EDITOR_CLIPBOARD_KIND,
      origin: { x: 1, y: 1 },
      schemaVersion: EDITOR_CLIPBOARD_SCHEMA_VERSION,
      surface: createSurface(2, 2, new Uint8Array([BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL, TRANSPARENT_PIXEL])),
      mask,
    };
    desktopApiMock.readSelectionFromDesktopClipboard.mockResolvedValue(serializeEditorClipboard(clipboard));
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");
    const initialContentRevision = layer.contentRevision;
    layer.surface.data[indexFor(2, 1, layer.surface.width)] = WHITE_PIXEL;

    await expect(useEditorStore.getState().pasteClipboard()).resolves.toBe(true);

    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(currentActivePixelLayer()?.surface.data[indexFor(2, 1, layer.surface.width)]).toBe(WHITE_PIXEL);
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 2, layer.surface.width)]).toBe(WHITE_PIXEL);
    expect(currentActivePixelLayer()?.contentRevision).toBe(initialContentRevision + 1);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(TRANSPARENT_PIXEL);
    expect(useEditorStore.getState().rootSelection).toBeNull();
  });

  it("fails paste cleanly when the desktop clipboard has no Pixel Studio payload", async () => {
    desktopApiMock.readSelectionFromDesktopClipboard.mockResolvedValue(null);

    await expect(useEditorStore.getState().pasteClipboard()).resolves.toBe(false);

    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("undoes and redoes selection clearing", () => {
    const state = useEditorStore.getState();
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 1, y: 1 });
    state.clearSelection();

    expect(useEditorStore.getState().rootSelection).toBeNull();
    expect(useEditorStore.getState().undoStack).toHaveLength(2);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().rootSelection).toBeNull();
  });

  it("adds and subtracts from the active selection", () => {
    const state = useEditorStore.getState();
    state.setSelectionFromRect({ x: 0, y: 0 }, { x: 1, y: 1 });
    state.setSelectionFromRect({ x: 3, y: 3 }, { x: 3, y: 3 }, "add");

    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(0, 0)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(3, 3)]).toBe(1);

    state.setSelectionFromRect({ x: 0, y: 0 }, { x: 0, y: 0 }, "subtract");

    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(0, 0)]).toBe(0);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(3, 3)]).toBe(1);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 0, top: 0, right: 3, bottom: 3 });
  });

  it("keeps newer selection edits when undoing an older document edit", () => {
    const state = useEditorStore.getState();
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected active pixel layer");

    state.beginCommand("Draw stroke");
    layer.surface.data[indexFor(1, 1, layer.surface.width)] = BLACK_PIXEL;
    state.markDocumentChanged();
    state.commitCommand("Draw stroke");

    state.setSelectionFromRect({ x: 3, y: 3 }, { x: 3, y: 3 });

    useEditorStore.getState().undo();
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().rootSelection).toBeNull();

    useEditorStore.getState().undo();
    expect(currentActivePixelLayer()?.surface.data[indexFor(1, 1, layer.surface.width)]).toBe(0);
    expect(useEditorStore.getState().rootSelection).toBeNull();
  });

  it("creates root selections and clears object selections when leaving object editing", () => {
    const state = useEditorStore.getState();
    state.setSelectionFromRect({ x: 1, y: 1 }, { x: 2, y: 2 });
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);

    state.addObject();
    useEditorStore.getState().setSelectionFromRect({ x: 0, y: 0 }, { x: 0, y: 0 });
    expect(useEditorStore.getState().objectSelection).not.toBeNull();

    useEditorStore.getState().switchToRoot();
    expect(useEditorStore.getState().rootSelection?.mask.data[indexFor(1, 1)]).toBe(1);
    expect(useEditorStore.getState().objectSelection).toBeNull();
  });

  it("creates a new alpha mask from the active selection", () => {
    const state = useEditorStore.getState();
    state.setSelectionFromRect({ x: 2, y: 2 }, { x: 3, y: 3 });
    state.addActiveLayerAlphaMask();

    const layer = currentActiveLayer();
    expect(layer?.alphaMask?.data[indexFor(2, 2)]).toBe(1);
    expect(layer?.alphaMask?.data[indexFor(1, 1)]).toBe(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(2);
  });

  it("creates a fully visible alpha mask when no selection exists", () => {
    const state = useEditorStore.getState();
    state.addActiveLayerAlphaMask();

    const layer = currentActiveLayer();
    expect(layer?.alphaMask?.data.every((value) => value === 1)).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });

  it("tracks alpha mask creation as an undoable no-op gesture change", () => {
    const state = useEditorStore.getState();
    const startRevision = state.documentRevision;

    const transaction = beginGestureTransaction("Erase alpha mask");
    const result = ensureDraftActiveLayerAlphaMask(true);
    transaction.commit(Boolean(result?.created));

    expect(result?.created).toBe(true);
    expect(currentActiveLayer()?.alphaMask?.data.every((value) => value === 1)).toBe(true);
    expect(useEditorStore.getState().documentRevision).toBe(startRevision + 1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);

    useEditorStore.getState().undo();

    expect(currentActiveLayer()?.alphaMask).toBeUndefined();
  });

  it("creates one undo command and document revision for changed mask painting", () => {
    useEditorStore.setState({ activeTool: "eraser", editTarget: "alphaMask" });
    const startRevision = useEditorStore.getState().documentRevision;
    const gesture = beginAlphaMaskGesture(
      { x: 0, y: 0 },
      "eraser",
      { requestCanvasRender: vi.fn(), requestSelectionOverlayRender: vi.fn() },
    );
    if (gesture.type !== "drawingAlphaMask") throw new Error("Expected alpha mask gesture");
    finishAlphaMaskGesture(gesture, {
      point: { x: 0, y: 0 },
      altKey: false,
      shiftKey: false,
    });

    expect(useEditorStore.getState().documentRevision).toBe(startRevision + 1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(currentActiveLayer()?.alphaMask?.data[indexFor(0, 0)]).toBe(0);

    useEditorStore.getState().undo();

    expect(currentActiveLayer()?.alphaMask).toBeUndefined();
  });

  it("handles missing active layers as no-op tool actions", () => {
    useEditorStore.setState((state) => ({
      root: {
        ...state.root,
        activeLayerIndex: 99,
      },
    }));

    const state = useEditorStore.getState();
    useEditorStore.setState({ activeTool: "pencil" });
    expect(currentActiveLayer()).toBeUndefined();

    state.setTool("move");
    expect(useEditorStore.getState().activeTool).toBe("pencil");

    state.clearActiveLayer();
    expect(useEditorStore.getState().status).toBe("Active layer does not support pixel drawing");
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("returns to pixel editing when removing the active alpha mask", () => {
    const state = useEditorStore.getState();
    state.addActiveLayerAlphaMask();
    state.setEditTarget("alphaMask");

    state.removeActiveLayerAlphaMask();

    expect(currentActiveLayer()?.alphaMask).toBeUndefined();
    expect(useEditorStore.getState().editTarget).toBe("pixels");
  });

  it("converts canvas-space selections to object-local alpha masks", () => {
    const object = createObjectDefinition("object-1", "Object 1", 4, 4);
    const instance = createObjectInstanceLayer(2, "Object 1", object.id);
    instance.x = 10;
    instance.y = 20;
    useEditorStore.setState((state) => ({
      objects: [object],
      root: {
        ...state.root,
        activeLayerIndex: 1,
        layers: [state.root.layers[0], instance],
      },
    }));

    useEditorStore.getState().setSelectionFromRect({ x: 11, y: 21 }, { x: 12, y: 22 });
    useEditorStore.getState().addActiveLayerAlphaMask();

    const layer = currentActiveLayer();
    expect(layer?.alphaMask?.width).toBe(4);
    expect(layer?.alphaMask?.height).toBe(4);
    expect(layer?.alphaMask?.data[1 * 4 + 1]).toBe(1);
    expect(layer?.alphaMask?.data[0]).toBe(0);
  });
});

function resetStore(): void {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  desktopApiMock.readSelectionFromDesktopClipboard.mockResolvedValue(null);
  desktopApiMock.writeSelectionToDesktopClipboard.mockResolvedValue(true);
  desktopApiMock.openProjectFileWithDesktopDialog.mockResolvedValue({ canceled: true, ok: true });
  desktopApiMock.saveBlobWithDesktopDialog.mockResolvedValue(false);
  useEditorStore.getState().newProject();
  useEditorStore.setState({
    canRedo: false,
    canUndo: false,
    colorizedPatternsModifierActive: false,
    colorizedPatternsVisible: false,
    currentProjectId: null,
    hasUnsavedChanges: false,
    pendingCommand: null,
    pendingMove: null,
    pendingSelectionMove: null,
    projectName: "Untitled Playdate Art",
    recentProjects: [],
    redoStack: [],
    documentRevision: 0,
    activeSwatchRef: BLACK_PIXEL,
    editTarget: "pixels",
    objectSelection: null,
    rootSelection: null,
    savedDocumentRevision: 0,
    status: "Ready",
    undoStack: [],
    viewRevision: 0,
  });
}
