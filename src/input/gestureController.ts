import { activeStack } from "../domain/layers";
import type { EditorSnapshot } from "../domain/types";
import { beginAlphaMaskGesture, finishAlphaMaskGesture, updateAlphaMaskGesture } from "./alphaMaskGestures";
import { beginMoveGesture, cancelMoveGesture, finishMoveGesture, updateMoveGesture } from "./moveGestures";
import { beginPixelGesture, finishPixelGesture, updatePixelGesture } from "./pixelGestures";
import {
  beginSelectionGesture,
  cancelSelectionGesture,
  finishSelectionGesture,
  updateSelectionGesture,
} from "./selectionGestures";
import {
  idleGestureState,
  isActiveGesture,
  isSelectionTool,
  selectionCombineModeForModifiers,
  type EditorGestureEvent,
  type EditorGestureState,
  type GestureRenderBridge,
} from "./gestureTypes";
import { useEditorStore } from "../state/editorStore";

export function beginEditorGesture(event: EditorGestureEvent, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  const tool = state.activeTool;
  const point = event.point;

  if (isSelectionTool(tool)) {
    return trackGestureActivity(beginSelectionGesture(point, tool, selectionCombineModeForModifiers(event), bridge));
  }

  if (tool === "move") {
    return trackGestureActivity(beginMoveGesture(point));
  }

  if (state.editTarget === "alphaMask") {
    return trackGestureActivity(beginAlphaMaskGesture(point, tool, bridge));
  }

  return trackGestureActivity(beginPixelGesture(point, tool, bridge));
}

export function updateEditorGesture(
  gesture: EditorGestureState,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  if (gesture.type === "idle") return gesture;
  if (gesture.type === "selecting") {
    return updateSelectionGesture(gesture, event, bridge);
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
  if (gesture.type === "idle") return trackGestureActivity(gesture);
  if (gesture.type === "selecting") {
    return trackGestureActivity(finishSelectionGesture(gesture, event, bridge));
  }

  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    return trackGestureActivity(finishMoveGesture(gesture, event, bridge));
  }

  if (gesture.type === "drawingAlphaMask") {
    return trackGestureActivity(finishAlphaMaskGesture(gesture, event));
  }

  return trackGestureActivity(finishPixelGesture(gesture, event));
}

export function cancelEditorGesture(gesture: EditorGestureState, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  if (gesture.type === "idle") return trackGestureActivity(gesture);
  if (gesture.type === "selecting") {
    return trackGestureActivity(cancelSelectionGesture(bridge));
  }
  if (gesture.type === "movingPixels" || gesture.type === "movingLayer") {
    return trackGestureActivity(cancelMoveGesture(bridge));
  }
  state.setCanvasToolPreview(null);
  if (gesture.changed) gesture.transaction.rollback();
  else gesture.transaction.discard();
  bridge.requestCanvasRender();
  return trackGestureActivity(idleGestureState);
}

export function clearEditorGestureActivity(): void {
  useEditorStore.setState({ gestureActive: false });
}

export function activeLayerStackSelector(state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">) {
  return activeStack(state);
}

function trackGestureActivity(gesture: EditorGestureState): EditorGestureState {
  useEditorStore.setState({ gestureActive: isActiveGesture(gesture) });
  return gesture;
}
