import { activeStack } from "../domain/layers";
import type { EditorSnapshot } from "../domain/types";
import { beginAlphaMaskGesture, finishAlphaMaskGesture, updateAlphaMaskGesture } from "./alphaMaskGestures";
import { beginMoveGesture, cancelMoveGesture, finishMoveGesture, updateMoveGesture } from "./moveGestures";
import { beginPixelGesture, finishPixelGesture, updatePixelGesture } from "./pixelGestures";
import { beginSelectionGesture, cancelSelectionGesture, finishSelectionGesture, updateSelectionGesture } from "./selectionGestures";
import {
  idleGestureState,
  isSelectionTool,
  selectionCombineModeForModifiers,
  type EditorGestureEvent,
  type EditorGestureState,
  type GestureRenderBridge,
} from "./gestureTypes";
import { useEditorStore } from "../state/editorStore";

export function beginEditorGesture(
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  const tool = state.activeTool;
  const point = event.point;

  if (isSelectionTool(tool)) {
    return beginSelectionGesture(point, tool, selectionCombineModeForModifiers(event));
  }

  if (tool === "move") {
    return beginMoveGesture(point);
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
  if (gesture.type === "selecting") {
    return updateSelectionGesture(gesture, event);
  }

  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    return updateMoveGesture(gesture, event, bridge);
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
  if (gesture.type === "selecting") {
    return finishSelectionGesture(gesture, event);
  }

  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    return finishMoveGesture(gesture, event, bridge);
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
    return cancelSelectionGesture();
  }
  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    return cancelMoveGesture(bridge);
  }
  state.setCanvasToolPreview(null);
  state.discardPendingCommand();
  bridge.requestCanvasRender();
  return idleGestureState;
}

export function activeLayerStackSelector(state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">) {
  return activeStack(state);
}
