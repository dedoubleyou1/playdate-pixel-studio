import { activeLayer, activeStack, cloneLayerStack, cloneObjectDefinition } from "../domain/layers";
import {
  applyMaskToolDrag,
  applyMaskToolFinish,
  applyMaskToolStart,
  createMaskCanvasToolPreview,
  maskCommandLabel,
} from "../domain/maskCommands";
import { createBinaryMaskSurface } from "../domain/masks";
import {
  isBrushTool,
  isFillTool,
  isShapeTool,
} from "../domain/pixelCommands";
import type { BinaryMaskSurface, EditorSnapshot, Layer, LayerStack, ObjectDefinition, PixelLayer, Point, Tool } from "../domain/types";
import { currentActiveLayer, useEditorStore } from "../state/editorStore";
import { maskToolSettings } from "./gestureSettings";
import { beginGestureTransaction } from "./gestureTransaction";
import { constrainedShapeEndPoint, idleGestureState, type EditorGestureEvent, type EditorGestureState, type GestureRenderBridge } from "./gestureTypes";

export function beginAlphaMaskGesture(point: Point, tool: Tool, bridge: GestureRenderBridge): EditorGestureState {
  const state = useEditorStore.getState();
  const settings = maskToolSettings(tool);
  const localPoint = activeMaskPoint(point, state);
  if (!localPoint) {
    state.setStatus("Pointer is outside the active alpha mask");
    return idleGestureState;
  }

  const transaction = beginGestureTransaction(maskCommandLabel(tool));
  if (isBrushTool(tool) || isFillTool(tool)) {
    const maskResult = currentAlphaMaskForTool(state, settings.value);
    const startChanged = maskResult ? applyMaskToolStart(maskResult.mask, localPoint, tool, settings) : false;
    const changed = Boolean(maskResult?.created) || startChanged;
    if (changed) bridge.requestCanvasRender();
    if (isFillTool(tool)) {
      transaction.commit(changed);
      return idleGestureState;
    }
    return { type: "drawingAlphaMask", changed, lastPoint: point, start: point, tool, transaction };
  }

  if (isShapeTool(tool)) {
    const maskResult = settings.value === 0 ? currentAlphaMaskForTool(state, settings.value) : null;
    state.setCanvasToolPreview(createMaskCanvasToolPreview(point, point, tool, settings));
    return {
      type: "drawingAlphaMask",
      changed: Boolean(maskResult?.created),
      lastPoint: point,
      start: point,
      tool,
      transaction,
    };
  }

  transaction.discard();
  return idleGestureState;
}

export function updateAlphaMaskGesture(
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

export function finishAlphaMaskGesture(
  gesture: Extract<EditorGestureState, { type: "drawingAlphaMask" }>,
  event: EditorGestureEvent,
): EditorGestureState {
  const state = useEditorStore.getState();
  const settings = maskToolSettings(gesture.tool);
  const mask = currentActiveLayer()?.alphaMask;
  if (!mask) {
    state.setCanvasToolPreview(null);
    gesture.transaction.discard();
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
  gesture.transaction.commit(changed);
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
  return ensureDraftActiveLayerAlphaMask(true);
}

export function ensureDraftActiveLayerAlphaMask(fillVisible = true): { mask: BinaryMaskSurface; created: boolean } | null {
  const state = useEditorStore.getState();
  const stack = activeStack(state);
  const layer = stack.layers[stack.activeLayerIndex];
  if (!layer) return null;
  if (layer.alphaMask) return { mask: layer.alphaMask, created: false };
  const size = layerAlphaMaskSize(layer, state.objects);
  if (!size) return null;
  const alphaMask = createBinaryMaskSurface(size.width, size.height, fillVisible);
  useEditorStore.setState((current) => {
    const currentStack = activeStack(current);
    return {
      ...replaceActiveStack(current, {
        ...currentStack,
        layers: currentStack.layers.map((candidate, index) =>
          index === currentStack.activeLayerIndex ? { ...candidate, alphaMask } : candidate,
        ),
      }),
    };
  });
  const createdMask = activeLayer(useEditorStore.getState())?.alphaMask;
  return createdMask ? { mask: createdMask, created: true } : null;
}

export function activeMaskPoint(point: Point, state: ReturnType<typeof useEditorStore.getState>): Point | null {
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

function replaceActiveStack(
  state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">,
  stack: LayerStack,
): Pick<EditorSnapshot, "root" | "objects"> {
  if (state.activeContext.type === "root") {
    return { root: cloneLayerStack(stack), objects: state.objects };
  }
  const context = state.activeContext;

  return {
    root: state.root,
    objects: state.objects.map((object) =>
      object.id === context.objectId
        ? { ...cloneObjectDefinition(object), ...stack, layers: stack.layers.filter(isPixelLayer) }
        : object,
    ),
  };
}

function layerAlphaMaskSize(layer: Layer, objects: ObjectDefinition[]): { width: number; height: number } | null {
  if (layer.type === "pixel") return { width: layer.surface.width, height: layer.surface.height };
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  return object ? { width: object.width, height: object.height } : null;
}

function isPixelLayer(layer: Layer): layer is PixelLayer {
  return layer.type === "pixel";
}
