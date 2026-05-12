import { beforeEach, describe, expect, it, vi } from "vitest";
import { indexFor } from "../domain/pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL } from "../domain/types";
import { currentActiveLayer, currentActivePixelLayer, useEditorStore } from "../state/editorStore";
import { beginEditorGesture, cancelEditorGesture, finishEditorGesture, updateEditorGesture } from "./gestureController";
import {
  idleGestureState,
  selectionCombineModeForModifiers,
  type EditorGestureState,
  type GestureRenderBridge,
} from "./gestureTypes";

describe("editor gesture controller", () => {
  let bridge: GestureRenderBridge;

  beforeEach(() => {
    useEditorStore.getState().newProject();
    useEditorStore.setState({
      activePaletteIndex: BLACK_PIXEL,
      activeTool: "pencil",
      canvasToolPreview: null,
      documentRevision: 0,
      editTarget: "pixels",
      hasUnsavedChanges: false,
      objectSelection: null,
      pendingCommand: null,
      pendingMove: null,
      pendingSelectionMove: null,
      redoStack: [],
      rootSelection: null,
      selectionPreview: null,
      undoStack: [],
      viewRevision: 0,
    });
    bridge = { requestCanvasRender: vi.fn() };
  });

  it("commits continuous pixel strokes once at finish", () => {
    const layer = currentActivePixelLayer();
    if (!layer) throw new Error("Expected pixel layer");
    let gesture = beginEditorGesture({ point: { x: 0, y: 0 }, shiftKey: false }, bridge);

    gesture = updateEditorGesture(gesture, { point: { x: 1, y: 0 }, shiftKey: false }, bridge);
    gesture = finishEditorGesture(gesture, { point: { x: 1, y: 0 }, shiftKey: false }, bridge);

    expect(gesture).toBe(idleGestureState);
    expect(layer.surface.data[indexFor(0, 0)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(1, 0)]).toBe(BLACK_PIXEL);
    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("discards cancelled shape gestures without undo history", () => {
    useEditorStore.setState({ activeTool: "line" });
    let gesture = beginEditorGesture({ point: { x: 0, y: 0 }, shiftKey: false }, bridge);
    gesture = updateEditorGesture(gesture, { point: { x: 4, y: 0 }, shiftKey: false }, bridge);

    gesture = cancelEditorGesture(gesture, bridge);

    expect(gesture).toBe(idleGestureState);
    expect(useEditorStore.getState().canvasToolPreview).toBeNull();
    expect(useEditorStore.getState().pendingCommand).toBeNull();
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(currentActivePixelLayer()?.surface.data[indexFor(4, 0)]).toBe(TRANSPARENT_PIXEL);
  });

  it("commits alpha mask creation through the gesture transaction", () => {
    useEditorStore.setState({ activeTool: "eraser", editTarget: "alphaMask" });

    const gesture = beginEditorGesture({ point: { x: 0, y: 0 }, shiftKey: false }, bridge);
    finishEditorGesture(gesture, { point: { x: 0, y: 0 }, shiftKey: false }, bridge);

    expect(currentActiveLayer()?.alphaMask?.data[indexFor(0, 0)]).toBe(0);
    expect(useEditorStore.getState().documentRevision).toBe(1);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("commits selection gestures without dirtying the document", () => {
    useEditorStore.setState({ activeTool: "marquee" });
    let gesture: EditorGestureState = beginEditorGesture({ point: { x: 1, y: 1 }, shiftKey: false }, bridge);
    expect(useEditorStore.getState().activeSelectionCombineMode).toBe("replace");

    gesture = updateEditorGesture(gesture, { point: { x: 2, y: 2 }, shiftKey: false }, bridge);
    gesture = finishEditorGesture(gesture, { point: { x: 2, y: 2 }, shiftKey: false }, bridge);

    expect(gesture).toBe(idleGestureState);
    expect(useEditorStore.getState().activeSelectionCombineMode).toBeNull();
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 1, top: 1, right: 2, bottom: 2 });
    expect(useEditorStore.getState().documentRevision).toBe(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("tracks active selection combine cursor mode while dragging", () => {
    useEditorStore.setState({ activeTool: "marquee" });
    const addGesture = beginEditorGesture({ point: { x: 1, y: 1 }, shiftKey: true }, bridge);
    expect(useEditorStore.getState().activeSelectionCombineMode).toBe("add");
    cancelEditorGesture(addGesture, bridge);
    expect(useEditorStore.getState().activeSelectionCombineMode).toBeNull();

    const subtractGesture = beginEditorGesture({ altKey: true, point: { x: 1, y: 1 }, shiftKey: true }, bridge);
    expect(useEditorStore.getState().activeSelectionCombineMode).toBe("subtract");
    cancelEditorGesture(subtractGesture, bridge);
    expect(useEditorStore.getState().activeSelectionCombineMode).toBeNull();
  });

  it("uses shift as add mode instead of constraining ellipse selections", () => {
    useEditorStore.setState({ activeTool: "ellipseSelect" });
    let gesture = beginEditorGesture({ point: { x: 0, y: 0 }, shiftKey: true }, bridge);

    gesture = updateEditorGesture(gesture, { point: { x: 4, y: 2 }, shiftKey: true }, bridge);
    expect(useEditorStore.getState().selectionPreview?.end).toEqual({ x: 4, y: 2 });

    gesture = finishEditorGesture(gesture, { point: { x: 4, y: 2 }, shiftKey: true }, bridge);

    expect(gesture).toBe(idleGestureState);
    expect(useEditorStore.getState().rootSelection?.bounds).toEqual({ left: 0, top: 0, right: 4, bottom: 2 });
  });

  it("resolves selection combine modifiers with alt taking precedence", () => {
    expect(selectionCombineModeForModifiers({ shiftKey: false })).toBe("replace");
    expect(selectionCombineModeForModifiers({ shiftKey: true })).toBe("add");
    expect(selectionCombineModeForModifiers({ altKey: true, shiftKey: true })).toBe("subtract");
  });
});
