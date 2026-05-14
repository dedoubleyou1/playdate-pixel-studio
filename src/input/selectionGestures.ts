import { selectionOverlaySource, type SelectionOverlaySource } from "../rendering/selectionOverlaySource";
import { currentActiveStack, currentSelection, useEditorStore } from "../state/editorStore";
import {
  idleGestureState,
  selectionPreviewType,
  type EditorGestureEvent,
  type EditorGestureState,
  type GestureRenderBridge,
} from "./gestureTypes";
import type { Point, SelectionCombineMode, Tool } from "../domain/types";

export function beginSelectionGesture(
  point: Point,
  tool: Tool,
  combineMode: SelectionCombineMode,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  state.setActiveSelectionCombineMode(combineMode);
  bridge.requestSelectionOverlayRender(selectionPreviewSource(point, point, tool, combineMode));
  return { type: "selecting", combineMode, start: point, tool };
}

export function updateSelectionGesture(
  gesture: Extract<EditorGestureState, { type: "selecting" }>,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  bridge.requestSelectionOverlayRender(selectionPreviewSource(gesture.start, event.point, gesture.tool, gesture.combineMode));
  return gesture;
}

export function finishSelectionGesture(
  gesture: Extract<EditorGestureState, { type: "selecting" }>,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  if (gesture.tool === "ellipseSelect") {
    state.setSelectionFromEllipse(gesture.start, event.point, gesture.combineMode);
  } else {
    state.setSelectionFromRect(gesture.start, event.point, gesture.combineMode);
  }
  state.setActiveSelectionCombineMode(null);
  bridge.requestSelectionOverlayRender(null);
  return idleGestureState;
}

export function cancelSelectionGesture(bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  state.setActiveSelectionCombineMode(null);
  bridge.requestSelectionOverlayRender(null);
  return idleGestureState;
}

function selectionPreviewSource(
  start: Point,
  end: Point,
  tool: Tool,
  combineMode: SelectionCombineMode,
): SelectionOverlaySource {
  const stack = currentActiveStack();
  return selectionOverlaySource({
    activeSelection: currentSelection(),
    height: stack.height,
    pendingSelectionMove: null,
    selectionPreview: {
      brushSize: 1,
      combineMode,
      end,
      mirrorX: false,
      mirrorY: false,
      start,
      type: selectionPreviewType(tool),
    },
    width: stack.width,
  });
}
