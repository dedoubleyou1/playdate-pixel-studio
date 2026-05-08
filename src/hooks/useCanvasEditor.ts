import { useCallback, useEffect, useMemo, useRef } from "react";
import { activeStack } from "../domain/layers";
import {
  applyPixelToolDrag,
  applyPixelToolFinish,
  applyPixelToolStart,
  createShapePreview,
  isBrushTool,
  isFillTool,
  isShapeTool,
  pixelCommandLabel,
  type PixelToolSettings,
} from "../domain/pixelCommands";
import type { EditorSnapshot, Point, Tool } from "../domain/types";
import { EditorCanvas } from "../rendering/editorCanvas";
import type { LayerMovePreview } from "../rendering/frameComposer";
import { currentActivePixelLayer, useEditorStore } from "../state/editorStore";

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
  const objects = useEditorStore((state) => state.objects);
  const shapePreview = useEditorStore((state) => state.shapePreview);
  const viewRevision = useEditorStore((state) => state.viewRevision);

  useEffect(() => {
    editorCanvasRef.current = canvas ? new EditorCanvas(canvas, stack.width, stack.height) : null;
  }, [canvas, stack.height, stack.width]);

  const requestCanvasRender = useCallback(
    (movePreview: LayerMovePreview | null = null) => {
      renderMovePreviewRef.current = movePreview;
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
      renderFrameRef.current = window.requestAnimationFrame(() => {
        editorCanvasRef.current?.render(
          stack.layers,
          shapePreview,
          objects,
          stack.background,
          renderMovePreviewRef.current,
        );
        renderFrameRef.current = null;
        renderMovePreviewRef.current = null;
      });
    },
    [objects, shapePreview, stack.background, stack.layers],
  );

  useEffect(() => {
    requestCanvasRender();

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [requestCanvasRender, viewRevision]);

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
      paintMode: state.activePaintMode,
    };
  }, []);

  const beginStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas) return;

      const state = useEditorStore.getState();
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const tool = state.activeTool;

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
        state.setShapePreview(createShapePreview(point, point, tool, settings));
      }
    },
    [pixelToolSettings, requestCanvasRender],
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
      if (gestureTool === "move") {
        const dragStart = dragStartRef.current ?? point;
        const dx = point.x - dragStart.x;
        const dy = point.y - dragStart.y;
        const lastDelta = lastMoveDeltaRef.current;
        const previewChanged = !lastDelta || lastDelta.x !== dx || lastDelta.y !== dy;
        actionChangedRef.current = previewChanged || actionChangedRef.current;
        if (previewChanged && moveLayerIndexRef.current !== null) {
          lastMoveDeltaRef.current = { x: dx, y: dy };
          requestCanvasRender({ layerIndex: moveLayerIndexRef.current, dx, dy });
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

      if (state.shapePreview) {
        state.setShapePreview(createShapePreview(state.shapePreview.start, point, gestureTool, settings));
      }
    },
    [pixelToolSettings, requestCanvasRender],
  );

  const finishStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      const dragStart = dragStartRef.current;
      if (!editorCanvas || !isDrawingRef.current || !dragStart) return;

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const state = useEditorStore.getState();
      const gestureTool = gestureToolRef.current ?? state.activeTool;
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

      const layer = currentActivePixelLayer();
      const settings = gestureSettingsRef.current ?? pixelToolSettings();
      if (!layer) {
        state.setShapePreview(null);
        state.discardPendingCommand();
        resetGestureRefs();
        return;
      }

      if (isShapeTool(gestureTool)) {
        actionChangedRef.current = applyPixelToolFinish(layer, dragStart, point, gestureTool, settings).changed;
      }

      state.setShapePreview(null);

      if (actionChangedRef.current) {
        state.markDocumentChanged();
      }
      state.commitCommand(pixelCommandLabel(gestureTool));
      resetGestureRefs();
    },
    [pixelToolSettings, requestCanvasRender, resetGestureRefs],
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
