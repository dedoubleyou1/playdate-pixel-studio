import { activeStack } from "../domain/layers";
import type { EditorSnapshot } from "../domain/types";
import { useEditorStore } from "../state/editorStore";
import { beginAlphaMaskGesture, finishAlphaMaskGesture, updateAlphaMaskGesture } from "./alphaMaskGestures";
import { beginPixelGesture, finishPixelGesture, updatePixelGesture } from "./pixelGestures";
import {
  constrainedShapeEndPoint,
  idleGestureState,
  isSelectionTool,
  selectionPreviewType,
  type EditorGestureEvent,
  type EditorGestureState,
  type GestureRenderBridge,
} from "./gestureTypes";

export function beginEditorGesture(
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  const tool = state.activeTool;
  const point = event.point;

  if (isSelectionTool(tool)) {
    state.setSelectionPreview({
      type: selectionPreviewType(tool),
      start: point,
      end: point,
      brushSize: 1,
      mirrorX: false,
      mirrorY: false,
    });
    return { type: "selecting", start: point, tool };
  }

  if (tool === "move") {
    if (!state.beginMoveLayer()) return idleGestureState;
    const pendingSelectionMove = useEditorStore.getState().pendingSelectionMove;
    const gestureType = pendingSelectionMove ? "movingPixels" : "movingLayer";
    return {
      type: gestureType,
      layerIndex: activeStack(state).activeLayerIndex,
      lastDelta: { x: 0, y: 0 },
      start: point,
      tool,
    };
  }

  if (state.editTarget === "alphaMask") {
    return beginAlphaMaskGesture(point, tool, bridge);
  }

  return beginPixelGesture(point, tool, bridge);
}

export function updateEditorGesture(
  gesture: EditorGestureState,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  if (gesture.type === "idle") return gesture;
  const state = useEditorStore.getState();
  const point = event.point;

  if (gesture.type === "selecting") {
    const previewPoint = constrainedShapeEndPoint(gesture.start, point, gesture.tool, event.shiftKey);
    state.setSelectionPreview({
      type: selectionPreviewType(gesture.tool),
      start: gesture.start,
      end: previewPoint,
      brushSize: 1,
      mirrorX: false,
      mirrorY: false,
    });
    return gesture;
  }

  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
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

  if (gesture.type === "drawingAlphaMask") {
    return updateAlphaMaskGesture(gesture, event, bridge);
  }

  return updatePixelGesture(gesture, event, bridge);
}

export function finishEditorGesture(
  gesture: EditorGestureState,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  if (gesture.type === "idle") return gesture;
  const state = useEditorStore.getState();
  const point = event.point;

  if (gesture.type === "selecting") {
    const constrainedPoint = constrainedShapeEndPoint(gesture.start, point, gesture.tool, event.shiftKey);
    if (gesture.tool === "ellipseSelect") {
      state.setSelectionFromEllipse(gesture.start, constrainedPoint);
    } else {
      state.setSelectionFromRect(gesture.start, constrainedPoint);
    }
    state.setSelectionPreview(null);
    return idleGestureState;
  }

  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    const changed = state.commitMoveLayer(dx, dy);
    if (!changed) bridge.requestCanvasRender();
    return idleGestureState;
  }

  if (gesture.type === "drawingAlphaMask") {
    return finishAlphaMaskGesture(gesture, event);
  }

  return finishPixelGesture(gesture, event);
}

export function cancelEditorGesture(gesture: EditorGestureState, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  if (gesture.type === "idle") return gesture;
  if (gesture.type === "selecting") {
    state.setSelectionPreview(null);
    return idleGestureState;
  }
  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    state.cancelMoveLayer();
    bridge.requestCanvasRender();
    return idleGestureState;
  }
  state.setCanvasToolPreview(null);
  state.discardPendingCommand();
  bridge.requestCanvasRender();
  return idleGestureState;
}

export function activeLayerStackSelector(state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">) {
  return activeStack(state);
}
