import { useEditorStore } from "../state/editorStore";
import { idleGestureState, selectionPreviewType, type EditorGestureEvent, type EditorGestureState } from "./gestureTypes";
import type { Point, SelectionCombineMode, Tool } from "../domain/types";

export function beginSelectionGesture(point: Point, tool: Tool, combineMode: SelectionCombineMode): EditorGestureState {
  const state = useEditorStore.getState();
  state.setActiveSelectionCombineMode(combineMode);
  state.setSelectionPreview({
    combineMode,
    type: selectionPreviewType(tool),
    start: point,
    end: point,
    brushSize: 1,
    mirrorX: false,
    mirrorY: false,
  });
  return { type: "selecting", combineMode, start: point, tool };
}

export function updateSelectionGesture(
  gesture: Extract<EditorGestureState, { type: "selecting" }>,
  event: EditorGestureEvent,
): EditorGestureState {
  useEditorStore.getState().setSelectionPreview({
    combineMode: gesture.combineMode,
    type: selectionPreviewType(gesture.tool),
    start: gesture.start,
    end: event.point,
    brushSize: 1,
    mirrorX: false,
    mirrorY: false,
  });
  return gesture;
}

export function finishSelectionGesture(
  gesture: Extract<EditorGestureState, { type: "selecting" }>,
  event: EditorGestureEvent,
): EditorGestureState {
  const state = useEditorStore.getState();
  if (gesture.tool === "ellipseSelect") {
    state.setSelectionFromEllipse(gesture.start, event.point, gesture.combineMode);
  } else {
    state.setSelectionFromRect(gesture.start, event.point, gesture.combineMode);
  }
  state.setSelectionPreview(null);
  state.setActiveSelectionCombineMode(null);
  return idleGestureState;
}

export function cancelSelectionGesture(): EditorGestureState {
  const state = useEditorStore.getState();
  state.setSelectionPreview(null);
  state.setActiveSelectionCombineMode(null);
  return idleGestureState;
}
