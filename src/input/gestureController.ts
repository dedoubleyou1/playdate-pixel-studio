import { activeLayer, activeStack } from "../domain/layers";
import {
  applyMaskToolDrag,
  applyMaskToolFinish,
  applyMaskToolStart,
  createMaskCanvasToolPreview,
  maskCommandLabel,
} from "../domain/maskCommands";
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
import type { BinaryMaskSurface, EditorSnapshot, Point, Tool } from "../domain/types";
import { currentActiveLayer, currentActivePixelLayer, useEditorStore } from "../state/editorStore";
import { maskToolSettings, pixelToolSettings } from "./gestureSettings";
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

function beginPixelGesture(point: Point, tool: Tool, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  const layer = currentActivePixelLayer();
  if (!layer) {
    state.setStatus("Active layer does not support pixel drawing.");
    return idleGestureState;
  }

  const settings = pixelToolSettings();
  if (isBrushTool(tool)) {
    state.beginCommand(pixelCommandLabel(tool));
    const changed = applyPixelToolStart(layer, point, tool, settings).changed;
    if (changed) bridge.requestCanvasRender();
    return { type: "drawingPixels", changed, lastPoint: point, start: point, tool };
  }

  if (isFillTool(tool)) {
    state.beginCommand(pixelCommandLabel(tool));
    const changed = applyPixelToolStart(layer, point, tool, settings).changed;
    if (changed) state.markDocumentChanged();
    state.commitCommand(pixelCommandLabel(tool));
    return idleGestureState;
  }

  if (isShapeTool(tool)) {
    state.beginCommand(pixelCommandLabel(tool));
    state.setCanvasToolPreview(createCanvasToolPreview(point, point, tool, settings));
    return { type: "drawingPixels", changed: false, lastPoint: point, start: point, tool };
  }

  return idleGestureState;
}

function updatePixelGesture(
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

function finishPixelGesture(
  gesture: Extract<EditorGestureState, { type: "drawingPixels" }>,
  event: EditorGestureEvent,
): EditorGestureState {
  const state = useEditorStore.getState();
  const layer = currentActivePixelLayer();
  const settings = pixelToolSettings();
  if (!layer) {
    state.setCanvasToolPreview(null);
    state.discardPendingCommand();
    return idleGestureState;
  }

  let changed = gesture.changed;
  if (isShapeTool(gesture.tool)) {
    const constrainedPoint = constrainedShapeEndPoint(gesture.start, event.point, gesture.tool, event.shiftKey);
    changed = applyPixelToolFinish(layer, gesture.start, constrainedPoint, gesture.tool, settings).changed;
  }

  state.setCanvasToolPreview(null);
  if (changed) state.markDocumentChanged();
  state.commitCommand(pixelCommandLabel(gesture.tool));
  return idleGestureState;
}

function beginAlphaMaskGesture(point: Point, tool: Tool, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  const settings = maskToolSettings(tool);
  const localPoint = activeMaskPoint(point, state);
  if (!localPoint) {
    state.setStatus("Pointer is outside the active alpha mask");
    return idleGestureState;
  }

  if (isBrushTool(tool) || isFillTool(tool)) {
    state.beginCommand(maskCommandLabel(tool));
    const maskResult = currentAlphaMaskForTool(state, settings.value);
    const startChanged = maskResult ? applyMaskToolStart(maskResult.mask, localPoint, tool, settings) : false;
    const changed = Boolean(maskResult?.created) || startChanged;
    if (changed) bridge.requestCanvasRender();
    if (isFillTool(tool)) {
      if (changed) state.markDocumentChanged();
      state.commitCommand(maskCommandLabel(tool));
      return idleGestureState;
    }
    return { type: "drawingAlphaMask", changed, lastPoint: point, start: point, tool };
  }

  if (isShapeTool(tool)) {
    state.beginCommand(maskCommandLabel(tool));
    const maskResult = settings.value === 0 ? currentAlphaMaskForTool(state, settings.value) : null;
    state.setCanvasToolPreview(createMaskCanvasToolPreview(point, point, tool, settings));
    return { type: "drawingAlphaMask", changed: Boolean(maskResult?.created), lastPoint: point, start: point, tool };
  }

  return idleGestureState;
}

function updateAlphaMaskGesture(
  gesture: Extract<EditorGestureState, { type: "drawingAlphaMask" }>,
  event: EditorGestureEvent,
  bridge: GestureRenderBridge,
): EditorGestureState {
  const state = useEditorStore.getState();
  const settings = maskToolSettings(gesture.tool);
  const mask = currentActiveLayer()?.alphaMask;
  if (!mask) return gesture;

  const previewPoint = constrainedShapeEndPoint(gesture.start, event.point, gesture.tool, event.shiftKey);
  const localPoint = activeMaskPoint(previewPoint, state);
  if (!localPoint) return gesture;

  let changed = gesture.changed;
  if (isBrushTool(gesture.tool)) {
    const localLastPoint = activeMaskPoint(gesture.lastPoint, state) ?? localPoint;
    const strokeChanged = applyMaskToolDrag(mask, localLastPoint, localPoint, gesture.tool, settings);
    changed = strokeChanged || changed;
    if (strokeChanged) bridge.requestCanvasRender();
  }

  if (state.canvasToolPreview) {
    state.setCanvasToolPreview(createMaskCanvasToolPreview(state.canvasToolPreview.start, previewPoint, gesture.tool, settings));
  }

  return { ...gesture, changed, lastPoint: event.point };
}

function finishAlphaMaskGesture(
  gesture: Extract<EditorGestureState, { type: "drawingAlphaMask" }>,
  event: EditorGestureEvent,
): EditorGestureState {
  const state = useEditorStore.getState();
  const settings = maskToolSettings(gesture.tool);
  const mask = currentActiveLayer()?.alphaMask;
  if (!mask) {
    state.setCanvasToolPreview(null);
    state.discardPendingCommand();
    return idleGestureState;
  }

  let changed = gesture.changed;
  if (isShapeTool(gesture.tool)) {
    const localStart = activeMaskPoint(gesture.start, state);
    const constrainedPoint = constrainedShapeEndPoint(gesture.start, event.point, gesture.tool, event.shiftKey);
    const localEnd = activeMaskPoint(constrainedPoint, state);
    const shapeChanged =
      localStart && localEnd ? applyMaskToolFinish(mask, localStart, localEnd, gesture.tool, settings) : false;
    changed = shapeChanged || changed;
  }

  state.setCanvasToolPreview(null);
  if (changed) state.markDocumentChanged();
  state.commitCommand(maskCommandLabel(gesture.tool));
  return idleGestureState;
}

function currentAlphaMaskForTool(
  state: ReturnType<typeof useEditorStore.getState>,
  value: 0 | 1,
): { mask: BinaryMaskSurface; created: boolean } | null {
  const layer = activeLayer(state);
  if (!layer) return null;
  if (layer.alphaMask) return { mask: layer.alphaMask, created: false };
  if (value === 1) return null;
  return state.ensureActiveLayerAlphaMask(true);
}

function activeMaskPoint(point: Point, state: ReturnType<typeof useEditorStore.getState>): Point | null {
  const layer = activeLayer(state);
  if (!layer) return null;
  if (layer.type === "object") {
    const object = state.objects.find((candidate) => candidate.id === layer.objectId);
    const local = { x: point.x - layer.x, y: point.y - layer.y };
    if (!object || local.x < 0 || local.y < 0 || local.x >= object.width || local.y >= object.height) return null;
    return local;
  }
  if (point.x < 0 || point.y < 0 || point.x >= layer.surface.width || point.y >= layer.surface.height) return null;
  return point;
}

export function activeLayerStackSelector(state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">) {
  return activeStack(state);
}
