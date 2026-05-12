import { useEditorStore } from "../state/editorStore";
import { constrainedShapeEndPoint, idleGestureState, selectionPreviewType, type EditorGestureEvent, type EditorGestureState } from "./gestureTypes";
import type { Point, SelectionCombineMode, Tool } from "../domain/types";

export function beginSelectionGesture(point: Point, tool: Tool, combineMode: SelectionCombineMode): EditorGestureState {
  useEditorStore.getState().setSelectionPreview({
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
  const previewPoint = constrainedShapeEndPoint(gesture.start, event.point, gesture.tool, event.shiftKey);
  useEditorStore.getState().setSelectionPreview({
    combineMode: gesture.combineMode,
    type: selectionPreviewType(gesture.tool),
    start: gesture.start,
    end: previewPoint,
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
  const constrainedPoint = constrainedShapeEndPoint(gesture.start, event.point, gesture.tool, event.shiftKey);
  if (gesture.tool === "ellipseSelect") {
    state.setSelectionFromEllipse(gesture.start, constrainedPoint, gesture.combineMode);
  } else {
    state.setSelectionFromRect(gesture.start, constrainedPoint, gesture.combineMode);
  }
  state.setSelectionPreview(null);
  return idleGestureState;
}

export function cancelSelectionGesture(): EditorGestureState {
  useEditorStore.getState().setSelectionPreview(null);
  return idleGestureState;
}
