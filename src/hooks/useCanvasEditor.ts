import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { activeLayer, activeStack } from "../domain/layers";
import {
  applyMaskToolDrag,
  applyMaskToolFinish,
  applyMaskToolStart,
  createMaskCanvasToolPreview,
  maskCommandLabel,
  type MaskToolSettings,
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
  type PixelToolSettings,
} from "../domain/pixelCommands";
import type { EditorSnapshot, Point, Tool } from "../domain/types";
import { EditorCanvas } from "../rendering/editorCanvas";
import type { LayerMovePreview } from "../rendering/frameComposer";
import { currentActiveLayer, currentActivePixelLayer, currentSelection, useEditorStore } from "../state/editorStore";

export function useCanvasEditor(canvas: HTMLCanvasElement | null): {
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
} {
  const editorCanvasRef = useRef<EditorCanvas | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const isDrawingRef = useRef(false);
  const dragStartRef = useRef<Point | null>(null);
  const lastStrokePointRef = useRef<Point | null>(null);
  const gestureToolRef = useRef<Tool | null>(null);
  const gestureSettingsRef = useRef<PixelToolSettings | null>(null);
  const actionChangedRef = useRef(false);
  const moveLayerIndexRef = useRef<number | null>(null);
  const lastMoveDeltaRef = useRef<Point | null>(null);
  const renderMovePreviewRef = useRef<LayerMovePreview | null>(null);

  const stack = useEditorStore((state) => activeLayerStackSelector(state));
  const viewRevision = useEditorStore((state) => state.viewRevision);

  const renderCanvasNow = useCallback((movePreview: LayerMovePreview | null = null) => {
    const current = useEditorStore.getState();
    const currentStack = activeStack(current);
    const currentPendingSelectionMove = current.pendingSelectionMove;
    editorCanvasRef.current?.render({
      activeLayerIndex: currentStack.activeLayerIndex,
      background: currentStack.background,
      colorizedPatterns: current.colorizedPatternsVisible,
      editTarget: current.editTarget,
      layers: currentStack.layers,
      movePreview,
      objects: current.objects,
      palette: current.palette,
      preview: current.canvasToolPreview,
      selectionMovePreview: currentPendingSelectionMove
        ? {
            alphaMask: currentPendingSelectionMove.implicitFullLayer
              ? currentPendingSelectionMove.sourceLayer.alphaMask
              : null,
            dx: currentPendingSelectionMove.dx,
            dy: currentPendingSelectionMove.dy,
            ...currentPendingSelectionMove.floating,
          }
        : null,
    });
  }, []);

  useLayoutEffect(() => {
    editorCanvasRef.current = canvas ? new EditorCanvas(canvas, stack.width, stack.height) : null;
    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
      renderMovePreviewRef.current = null;
    }
    renderCanvasNow();
  }, [canvas, renderCanvasNow, stack.height, stack.width, viewRevision]);

  const requestCanvasRender = useCallback(
    (movePreview: LayerMovePreview | null = null) => {
      renderMovePreviewRef.current = movePreview;
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
      renderFrameRef.current = window.requestAnimationFrame(() => {
        renderCanvasNow(renderMovePreviewRef.current);
        renderFrameRef.current = null;
        renderMovePreviewRef.current = null;
      });
    },
    [renderCanvasNow],
  );

  useEffect(() => {
    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, []);

  const resetGestureRefs = useCallback(() => {
    isDrawingRef.current = false;
    dragStartRef.current = null;
    lastStrokePointRef.current = null;
    gestureToolRef.current = null;
    gestureSettingsRef.current = null;
    moveLayerIndexRef.current = null;
    lastMoveDeltaRef.current = null;
    actionChangedRef.current = false;
  }, []);

  const pixelToolSettings = useCallback((): PixelToolSettings => {
    const state = useEditorStore.getState();
    return {
      brushSize: state.brushSize,
      mirrorX: state.mirrorX,
      mirrorY: state.mirrorY,
      paletteIndex: state.activePaletteIndex,
      selectionMask: currentSelection()?.mask ?? null,
    };
  }, []);

  const maskToolSettings = useCallback((tool: Tool): MaskToolSettings => {
    const state = useEditorStore.getState();
    return {
      brushSize: state.brushSize,
      mirrorX: state.mirrorX,
      mirrorY: state.mirrorY,
      value: tool === "eraser" ? 0 : 1,
    };
  }, []);

  const beginStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas) return;

      const state = useEditorStore.getState();
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const tool = state.activeTool;

      if (isSelectionTool(tool)) {
        event.currentTarget.setPointerCapture(event.pointerId);
        isDrawingRef.current = true;
        dragStartRef.current = point;
        lastStrokePointRef.current = point;
        gestureToolRef.current = tool;
        actionChangedRef.current = false;
        state.setSelectionPreview({
          type: selectionPreviewType(tool),
          start: point,
          end: point,
          brushSize: 1,
          mirrorX: false,
          mirrorY: false,
        });
        return;
      }

      if (tool === "move") {
        if (!state.beginMoveLayer()) return;
        moveLayerIndexRef.current = activeStack(state).activeLayerIndex;
        lastMoveDeltaRef.current = { x: 0, y: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        isDrawingRef.current = true;
        dragStartRef.current = point;
        lastStrokePointRef.current = point;
        gestureToolRef.current = tool;
        actionChangedRef.current = false;
        return;
      }

      if (state.editTarget === "alphaMask") {
        const settings = maskToolSettings(tool);
        const localPoint = activeMaskPoint(point, state);
        if (!localPoint) {
          state.setStatus("Pointer is outside the active alpha mask");
          return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        isDrawingRef.current = true;
        dragStartRef.current = point;
        lastStrokePointRef.current = point;
        gestureToolRef.current = tool;
        actionChangedRef.current = false;
        gestureSettingsRef.current = pixelToolSettings();

        if (isBrushTool(tool) || isFillTool(tool)) {
          state.beginCommand(maskCommandLabel(tool));
          const mask = currentAlphaMaskForTool(state, settings.value);
          actionChangedRef.current = mask ? applyMaskToolStart(mask, localPoint, tool, settings) : false;
          if (actionChangedRef.current) requestCanvasRender();
        }

        if (isFillTool(tool)) {
          isDrawingRef.current = false;
          dragStartRef.current = null;
          lastStrokePointRef.current = null;
          gestureToolRef.current = null;
          gestureSettingsRef.current = null;
          if (actionChangedRef.current) state.markDocumentChanged();
          state.commitCommand(maskCommandLabel(tool));
        }

        if (isShapeTool(tool)) {
          state.beginCommand(maskCommandLabel(tool));
          if (settings.value === 0) state.ensureActiveLayerAlphaMask(true);
          state.setCanvasToolPreview(createMaskCanvasToolPreview(point, point, tool, settings));
        }
        return;
      }

      const layer = currentActivePixelLayer();
      if (!layer) {
        state.setStatus("Active layer does not support pixel drawing.");
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      isDrawingRef.current = true;
      dragStartRef.current = point;
      lastStrokePointRef.current = point;
      gestureToolRef.current = tool;
      actionChangedRef.current = false;
      const settings = pixelToolSettings();
      gestureSettingsRef.current = settings;

      if (isBrushTool(tool)) {
        state.beginCommand(pixelCommandLabel(tool));
        actionChangedRef.current = applyPixelToolStart(layer, point, tool, settings).changed;
        if (actionChangedRef.current) {
          requestCanvasRender();
        }
      }

      if (isFillTool(tool)) {
        state.beginCommand(pixelCommandLabel(tool));
        actionChangedRef.current = applyPixelToolStart(layer, point, tool, settings).changed;
        isDrawingRef.current = false;
        dragStartRef.current = null;
        lastStrokePointRef.current = null;
        gestureToolRef.current = null;
        gestureSettingsRef.current = null;
        if (actionChangedRef.current) {
          state.markDocumentChanged();
        }
        state.commitCommand(pixelCommandLabel(tool));
      }

      if (isShapeTool(tool)) {
        state.beginCommand(pixelCommandLabel(tool));
        state.setCanvasToolPreview(createCanvasToolPreview(point, point, tool, settings));
      }
    },
    [maskToolSettings, pixelToolSettings, requestCanvasRender],
  );

  const continueStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas) return;
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const state = useEditorStore.getState();
      state.setCursorLabel(`x: ${point.x} y: ${point.y}`);
      if (!isDrawingRef.current) return;

      const layer = currentActivePixelLayer();
      const gestureTool = gestureToolRef.current ?? state.activeTool;
      if (isSelectionTool(gestureTool)) {
        const dragStart = dragStartRef.current ?? point;
        const previewPoint = constrainedShapeEndPoint(dragStart, point, gestureTool, event.shiftKey);
        state.setSelectionPreview({
          type: selectionPreviewType(gestureTool),
          start: dragStart,
          end: previewPoint,
          brushSize: 1,
          mirrorX: false,
          mirrorY: false,
        });
        return;
      }

      if (gestureTool === "move") {
        const dragStart = dragStartRef.current ?? point;
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;
        const lastDelta = lastMoveDeltaRef.current;
        const previewChanged = !lastDelta || lastDelta.x !== dx || lastDelta.y !== dy;
        actionChangedRef.current = previewChanged || actionChangedRef.current;
        if (previewChanged && moveLayerIndexRef.current !== null) {
          lastMoveDeltaRef.current = { x: dx, y: dy };
          const pendingSelectionMove = useEditorStore.getState().pendingSelectionMove;
          if (pendingSelectionMove) {
            state.previewSelectionMove(dx, dy);
            requestCanvasRender();
          } else {
            requestCanvasRender({ layerIndex: moveLayerIndexRef.current, dx, dy });
          }
        }
        return;
      }

      if (state.editTarget === "alphaMask") {
        const settings = maskToolSettings(gestureTool);
        const mask = currentActiveLayer().alphaMask;
        if (!mask) return;
        const previewPoint = constrainedShapeEndPoint(dragStartRef.current, point, gestureTool, event.shiftKey);
        const localPoint = activeMaskPoint(previewPoint, state);
        if (!localPoint) return;

        if (isBrushTool(gestureTool)) {
          const lastPoint = lastStrokePointRef.current ?? point;
          const localLastPoint = activeMaskPoint(lastPoint, state) ?? localPoint;
          const strokeChanged = applyMaskToolDrag(mask, localLastPoint, localPoint, gestureTool, settings);
          lastStrokePointRef.current = point;
          actionChangedRef.current = strokeChanged || actionChangedRef.current;
          if (strokeChanged) requestCanvasRender();
        }

        if (state.canvasToolPreview) {
          state.setCanvasToolPreview(createMaskCanvasToolPreview(state.canvasToolPreview.start, previewPoint, gestureTool, settings));
        }
        return;
      }

      if (!layer) return;
      const settings = gestureSettingsRef.current ?? pixelToolSettings();
      if (isBrushTool(gestureTool)) {
        const lastPoint = lastStrokePointRef.current ?? point;
        const strokeChanged = applyPixelToolDrag(layer, lastPoint, point, gestureTool, settings).changed;
        lastStrokePointRef.current = point;
        actionChangedRef.current = strokeChanged || actionChangedRef.current;
        if (strokeChanged) {
          requestCanvasRender();
        }
      }

      if (state.canvasToolPreview) {
        const previewPoint = constrainedShapeEndPoint(dragStartRef.current, point, gestureTool, event.shiftKey);
        state.setCanvasToolPreview(createCanvasToolPreview(state.canvasToolPreview.start, previewPoint, gestureTool, settings));
      }
    },
    [maskToolSettings, pixelToolSettings, requestCanvasRender],
  );

  const finishStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      const dragStart = dragStartRef.current;
      if (!editorCanvas || !isDrawingRef.current || !dragStart) return;

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const state = useEditorStore.getState();
      const gestureTool = gestureToolRef.current ?? state.activeTool;
      if (isSelectionTool(gestureTool)) {
        const constrainedPoint = constrainedShapeEndPoint(dragStart, point, gestureTool, event.shiftKey);
        if (gestureTool === "ellipseSelect") {
          state.setSelectionFromEllipse(dragStart, constrainedPoint);
        } else {
          state.setSelectionFromRect(dragStart, constrainedPoint);
        }
        state.setSelectionPreview(null);
        resetGestureRefs();
        return;
      }

      if (gestureTool === "move") {
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;
        const changed = state.commitMoveLayer(dx, dy);
        if (!changed) {
          requestCanvasRender();
        }
        resetGestureRefs();
        return;
      }

      if (state.editTarget === "alphaMask") {
        const settings = maskToolSettings(gestureTool);
        const mask = currentActiveLayer().alphaMask;
        if (!mask) {
          state.setCanvasToolPreview(null);
          state.discardPendingCommand();
          resetGestureRefs();
          return;
        }

        if (isShapeTool(gestureTool)) {
          const localStart = activeMaskPoint(dragStart, state);
          const constrainedPoint = constrainedShapeEndPoint(dragStart, point, gestureTool, event.shiftKey);
          const localEnd = activeMaskPoint(constrainedPoint, state);
          actionChangedRef.current =
            localStart && localEnd ? applyMaskToolFinish(mask, localStart, localEnd, gestureTool, settings) : false;
        }

        state.setCanvasToolPreview(null);
        if (actionChangedRef.current) {
          state.markDocumentChanged();
        }
        state.commitCommand(maskCommandLabel(gestureTool));
        resetGestureRefs();
        return;
      }

      const layer = currentActivePixelLayer();
      const settings = gestureSettingsRef.current ?? pixelToolSettings();
      if (!layer) {
        state.setCanvasToolPreview(null);
        state.discardPendingCommand();
        resetGestureRefs();
        return;
      }

      if (isShapeTool(gestureTool)) {
        const constrainedPoint = constrainedShapeEndPoint(dragStart, point, gestureTool, event.shiftKey);
        actionChangedRef.current = applyPixelToolFinish(layer, dragStart, constrainedPoint, gestureTool, settings).changed;
      }

      state.setCanvasToolPreview(null);

      if (actionChangedRef.current) {
        state.markDocumentChanged();
      }
      state.commitCommand(pixelCommandLabel(gestureTool));
      resetGestureRefs();
    },
    [maskToolSettings, pixelToolSettings, requestCanvasRender, resetGestureRefs],
  );

  return useMemo(
    () => ({
      onPointerDown: beginStroke,
      onPointerMove: continueStroke,
      onPointerUp: finishStroke,
      onPointerCancel: finishStroke,
      onPointerLeave: () => {
        if (!isDrawingRef.current) {
          useEditorStore.getState().setCursorLabel("x: -- y: --");
        }
      },
    }),
    [beginStroke, continueStroke, finishStroke],
  );
}

function activeLayerStackSelector(state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">) {
  return activeStack(state);
}

function constrainedShapeEndPoint(start: Point | null, end: Point, tool: Tool, constrain: boolean): Point {
  if (!start || !constrain || (tool !== "rect" && tool !== "ellipse" && tool !== "ellipseSelect")) return end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx) * size,
    y: start.y + Math.sign(dy) * size,
  };
}

function isSelectionTool(tool: Tool): boolean {
  return tool === "marquee" || tool === "ellipseSelect";
}

function selectionPreviewType(tool: Tool): "ellipse" | "rect" {
  return tool === "ellipseSelect" ? "ellipse" : "rect";
}

function currentAlphaMaskForTool(
  state: ReturnType<typeof useEditorStore.getState>,
  value: 0 | 1,
) {
  const layer = activeLayer(state);
  if (layer.alphaMask) return layer.alphaMask;
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
