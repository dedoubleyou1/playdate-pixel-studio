import { activeStack } from "../domain/layers";
import type { Point } from "../domain/types";
import { useEditorStore } from "../state/editorStore";
import { idleGestureState, type EditorGestureEvent, type EditorGestureState, type GestureRenderBridge } from "./gestureTypes";

export function beginMoveGesture(point: Point): EditorGestureState {
  const state = useEditorStore.getState();
  if (!state.beginMoveLayer()) return idleGestureState;
  const pendingSelectionMove = useEditorStore.getState().pendingSelectionMove;
  const gestureType = pendingSelectionMove ? "movingPixels" : "movingLayer";
  return {
    type: gestureType,
    layerIndex: activeStack(state).activeLayerIndex,
    lastDelta: { x: 0, y: 0 },
    start: point,
    tool: "move",
  };
}

export function updateMoveGesture(
  gesture: Extract<EditorGestureState, { type: "movingPixels" | "movingLayer" }>,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  const dx = event.point.x - gesture.start.x;
  const dy = event.point.y - gesture.start.y;
  if (gesture.lastDelta.x === dx && gesture.lastDelta.y === dy) return gesture;

  const pendingSelectionMove = useEditorStore.getState().pendingSelectionMove;
  if (pendingSelectionMove) {
    state.previewSelectionMove(dx, dy);
    bridge.requestCanvasRender();
  } else {
    bridge.requestCanvasRender({ layerIndex: gesture.layerIndex, dx, dy });
  }

  return { ...gesture, lastDelta: { x: dx, y: dy } };
}

export function finishMoveGesture(
  gesture: Extract<EditorGestureState, { type: "movingPixels" | "movingLayer" }>,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  const dx = event.point.x - gesture.start.x;
  const dy = event.point.y - gesture.start.y;
  const changed = state.commitMoveLayer(dx, dy);
  if (!changed) bridge.requestCanvasRender();
  return idleGestureState;
}

export function cancelMoveGesture(bridge: GestureRenderBridge): EditorGestureState {
  useEditorStore.getState().cancelMoveLayer();
  bridge.requestCanvasRender();
  return idleGestureState;
}
