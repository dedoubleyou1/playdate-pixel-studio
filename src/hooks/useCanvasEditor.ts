import { useCallback, useEffect, useMemo, useRef } from "react";
import { activeStack } from "../domain/layers";
import { drawBrushAt, drawInterpolatedStroke, drawLine, drawRect, floodFill } from "../domain/pixelOps";
import type { EditorSnapshot, Point, ShapePreview, Tool } from "../domain/types";
import { EditorCanvas } from "../rendering/editorCanvas";
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
  const actionChangedRef = useRef(false);

  const stack = useEditorStore((state) => activeLayerStackSelector(state));
  const objects = useEditorStore((state) => state.objects);
  const shapePreview = useEditorStore((state) => state.shapePreview);
  const viewRevision = useEditorStore((state) => state.viewRevision);

  useEffect(() => {
    editorCanvasRef.current = canvas ? new EditorCanvas(canvas, stack.width, stack.height) : null;
  }, [canvas, stack.height, stack.width]);

  useEffect(() => {
    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current);
    }
    renderFrameRef.current = window.requestAnimationFrame(() => {
      editorCanvasRef.current?.render(stack.layers, shapePreview, objects, stack.background);
      renderFrameRef.current = null;
    });

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [objects, shapePreview, stack.background, stack.layers, viewRevision]);

  const resetGestureRefs = useCallback(() => {
    isDrawingRef.current = false;
    dragStartRef.current = null;
    lastStrokePointRef.current = null;
    gestureToolRef.current = null;
    actionChangedRef.current = false;
  }, []);

  const brushOptions = useCallback((tool: Tool) => {
    const state = useEditorStore.getState();
    return {
      size: state.brushSize,
      mirrorX: state.mirrorX,
      mirrorY: state.mirrorY,
      paintValue: state.activePaintValue,
      tool,
    };
  }, []);

  const createShapePreview = useCallback((start: Point, end: Point, tool: Tool): ShapePreview => {
    const state = useEditorStore.getState();
    return {
      type: tool === "rect" ? "rect" : "line",
      start,
      end,
      brushSize: state.brushSize,
      mirrorX: state.mirrorX,
      mirrorY: state.mirrorY,
    };
  }, []);

  const beginStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas) return;

      const state = useEditorStore.getState();
      const layer = currentActivePixelLayer();
      if (!layer) {
        state.setStatus("Active layer does not support pixel drawing.");
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const tool = state.activeTool;
      isDrawingRef.current = true;
      dragStartRef.current = point;
      lastStrokePointRef.current = point;
      gestureToolRef.current = tool;
      actionChangedRef.current = false;

      if (tool === "pencil" || tool === "eraser" || tool === "dither") {
        state.beginCommand(tool === "eraser" ? "Erase stroke" : "Draw stroke");
        actionChangedRef.current = drawBrushAt(layer, point, brushOptions(tool));
        if (actionChangedRef.current) {
          state.markDocumentChanged();
        }
      }

      if (tool === "fill") {
        state.beginCommand("Fill area");
        actionChangedRef.current = floodFill(layer, point, state.activePaintValue);
        isDrawingRef.current = false;
        dragStartRef.current = null;
        lastStrokePointRef.current = null;
        gestureToolRef.current = null;
        if (actionChangedRef.current) {
          state.markDocumentChanged();
        }
        state.commitCommand("Fill area");
      }

      if (tool === "line" || tool === "rect") {
        state.beginCommand(tool === "line" ? "Draw line" : "Draw rectangle");
        state.setShapePreview(createShapePreview(point, point, tool));
      }
    },
    [brushOptions, createShapePreview],
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
      if (!layer) return;
      const gestureTool = gestureToolRef.current ?? state.activeTool;
      if (gestureTool === "pencil" || gestureTool === "eraser" || gestureTool === "dither") {
        const lastPoint = lastStrokePointRef.current ?? point;
        const strokeChanged = drawInterpolatedStroke(layer, lastPoint, point, brushOptions(gestureTool));
        lastStrokePointRef.current = point;
        actionChangedRef.current = strokeChanged || actionChangedRef.current;
        if (strokeChanged) {
          state.markDocumentChanged();
        }
      }

      if (state.shapePreview) {
        state.setShapePreview(createShapePreview(state.shapePreview.start, point, gestureTool));
      }
    },
    [brushOptions, createShapePreview],
  );

  const finishStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      const dragStart = dragStartRef.current;
      if (!editorCanvas || !isDrawingRef.current || !dragStart) return;

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const state = useEditorStore.getState();
      const layer = currentActivePixelLayer();
      const gestureTool = gestureToolRef.current ?? state.activeTool;
      if (!layer) {
        state.setShapePreview(null);
        state.discardPendingCommand();
        resetGestureRefs();
        return;
      }

      if (gestureTool === "line") {
        actionChangedRef.current = drawLine(layer, dragStart, point, brushOptions("line"));
      }
      if (gestureTool === "rect") {
        actionChangedRef.current = drawRect(layer, dragStart, point, brushOptions("rect"));
      }

      state.setShapePreview(null);

      if (actionChangedRef.current) {
        state.markDocumentChanged();
      }
      state.commitCommand(gestureTool === "line" ? "Draw line" : gestureTool === "rect" ? "Draw rectangle" : undefined);
      resetGestureRefs();
    },
    [brushOptions, resetGestureRefs],
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
