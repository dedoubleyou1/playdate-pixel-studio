import { useCallback, useEffect, useMemo, useRef } from "react";
import { activeLayer } from "../domain/layers";
import { drawBrushAt, drawLine, drawRect, floodFill } from "../domain/pixelOps";
import type { Point, ShapePreview, Tool } from "../domain/types";
import { EditorCanvas } from "../rendering/editorCanvas";
import { useEditorStore } from "../state/editorStore";

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
  const actionChangedRef = useRef(false);

  const layers = useEditorStore((state) => state.layers);
  const shapePreview = useEditorStore((state) => state.shapePreview);
  const revision = useEditorStore((state) => state.revision);

  useEffect(() => {
    editorCanvasRef.current = canvas ? new EditorCanvas(canvas) : null;
  }, [canvas]);

  useEffect(() => {
    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current);
    }
    renderFrameRef.current = window.requestAnimationFrame(() => {
      editorCanvasRef.current?.render(layers, shapePreview);
      renderFrameRef.current = null;
    });

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [layers, shapePreview, revision]);

  const brushOptions = useCallback((tool: Tool) => {
    const state = useEditorStore.getState();
    return {
      size: state.brushSize,
      mirrorX: state.mirrorX,
      mirrorY: state.mirrorY,
      tool,
    };
  }, []);

  const createShapePreview = useCallback((start: Point, end: Point): ShapePreview => {
    const state = useEditorStore.getState();
    return {
      type: state.activeTool === "rect" ? "rect" : "line",
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
      const layer = activeLayer(state);
      if (layer.locked) {
        state.setStatus("Active layer is locked");
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      isDrawingRef.current = true;
      dragStartRef.current = point;
      actionChangedRef.current = false;

      if (state.activeTool === "pencil" || state.activeTool === "eraser" || state.activeTool === "dither") {
        state.beginCommand(state.activeTool === "eraser" ? "Erase stroke" : "Draw stroke");
        actionChangedRef.current = drawBrushAt(layer, point, brushOptions(state.activeTool));
        state.markDocumentChanged();
      }

      if (state.activeTool === "fill") {
        state.beginCommand("Fill area");
        actionChangedRef.current = floodFill(layer, point, 1);
        isDrawingRef.current = false;
        if (actionChangedRef.current) {
          state.markDocumentChanged();
          state.commitCommand("Fill area");
        }
      }

      if (state.activeTool === "line" || state.activeTool === "rect") {
        state.beginCommand(state.activeTool === "line" ? "Draw line" : "Draw rectangle");
        state.setShapePreview(createShapePreview(point, point));
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

      const layer = activeLayer(state);
      if (state.activeTool === "pencil" || state.activeTool === "eraser" || state.activeTool === "dither") {
        actionChangedRef.current =
          drawBrushAt(layer, point, brushOptions(state.activeTool)) || actionChangedRef.current;
        state.markDocumentChanged();
      }

      if (state.shapePreview) {
        state.setShapePreview(createShapePreview(state.shapePreview.start, point));
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
      const layer = activeLayer(state);

      if (state.activeTool === "line") {
        actionChangedRef.current = drawLine(layer, dragStart, point, brushOptions("pencil"));
      }
      if (state.activeTool === "rect") {
        actionChangedRef.current = drawRect(layer, dragStart, point, brushOptions("pencil"));
      }

      isDrawingRef.current = false;
      dragStartRef.current = null;
      state.setShapePreview(null);

      if (actionChangedRef.current) {
        state.markDocumentChanged();
        state.commitCommand(
          state.activeTool === "line" ? "Draw line" : state.activeTool === "rect" ? "Draw rectangle" : undefined,
        );
      }
    },
    [brushOptions],
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
