import {
  applyPixelToolDrag,
  applyPixelToolFinish,
  applyPixelToolStart,
  createCanvasToolPreview,
  isBrushTool,
  isFillTool,
  isShapeTool,
  pixelCommandLabel,
} from "../domain/pixelCommands";
import type { Point, Tool } from "../domain/types";
import { currentActivePixelLayer, useEditorStore } from "../state/editorStore";
import { pixelToolSettings } from "./gestureSettings";
import { beginGestureTransaction } from "./gestureTransaction";
import { constrainedShapeEndPoint, idleGestureState, type EditorGestureEvent, type EditorGestureState, type GestureRenderBridge } from "./gestureTypes";

export function beginPixelGesture(point: Point, tool: Tool, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  const layer = currentActivePixelLayer();
  if (!layer) {
    state.setStatus("Active layer does not support pixel drawing.");
    return idleGestureState;
  }

  const settings = pixelToolSettings();
  const transaction = beginGestureTransaction(pixelCommandLabel(tool));
  if (isBrushTool(tool)) {
    const changed = applyPixelToolStart(layer, point, tool, settings).changed;
    if (changed) bridge.requestCanvasRender();
    return { type: "drawingPixels", changed, lastPoint: point, start: point, tool, transaction };
  }

  if (isFillTool(tool)) {
    const changed = applyPixelToolStart(layer, point, tool, settings).changed;
    transaction.commit(changed);
    return idleGestureState;
  }

  if (isShapeTool(tool)) {
    state.setCanvasToolPreview(createCanvasToolPreview(point, point, tool, settings));
    return { type: "drawingPixels", changed: false, lastPoint: point, start: point, tool, transaction };
  }

  transaction.discard();
  return idleGestureState;
}

export function updatePixelGesture(
  gesture: Extract<EditorGestureState, { type: "drawingPixels" }>,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  const layer = currentActivePixelLayer();
  if (!layer) return gesture;

  const point = event.point;
  const settings = pixelToolSettings();
  let changed = gesture.changed;

  if (isBrushTool(gesture.tool)) {
    const strokeChanged = applyPixelToolDrag(layer, gesture.lastPoint, point, gesture.tool, settings).changed;
    changed = strokeChanged || changed;
    if (strokeChanged) bridge.requestCanvasRender();
  }

  if (state.canvasToolPreview) {
    const previewPoint = constrainedShapeEndPoint(gesture.start, point, gesture.tool, event.shiftKey);
    state.setCanvasToolPreview(createCanvasToolPreview(state.canvasToolPreview.start, previewPoint, gesture.tool, settings));
  }

  return { ...gesture, changed, lastPoint: point };
}

export function finishPixelGesture(
  gesture: Extract<EditorGestureState, { type: "drawingPixels" }>,
  event: EditorGestureEvent,
): EditorGestureState {
  const state = useEditorStore.getState();
  const layer = currentActivePixelLayer();
  const settings = pixelToolSettings();
  if (!layer) {
    state.setCanvasToolPreview(null);
    gesture.transaction.discard();
    return idleGestureState;
  }

  let changed = gesture.changed;
  if (isShapeTool(gesture.tool)) {
    const constrainedPoint = constrainedShapeEndPoint(gesture.start, event.point, gesture.tool, event.shiftKey);
    changed = applyPixelToolFinish(layer, gesture.start, constrainedPoint, gesture.tool, settings).changed || changed;
  }

  state.setCanvasToolPreview(null);
  gesture.transaction.commit(changed);
  return idleGestureState;
}
