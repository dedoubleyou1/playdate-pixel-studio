import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  activeLayerStackSelector,
  beginEditorGesture,
  cancelEditorGesture,
  finishEditorGesture,
  updateEditorGesture,
} from "../input/gestureController";
import { activeStack } from "../domain/layers";
import { EditorCanvas } from "../rendering/editorCanvas";
import type { LayerMovePreview } from "../rendering/frameComposer";
import { useEditorStore } from "../state/editorStore";
import { idleGestureState, isActiveGesture, type EditorGestureState } from "../input/gestureTypes";

export function useCanvasEditor(canvas: HTMLCanvasElement | null): {
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
} {
  const editorCanvasRef = useRef<EditorCanvas | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const gestureStateRef = useRef<EditorGestureState>(idleGestureState);
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

  const beginStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas) return;

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const gesture = beginEditorGesture({ altKey: event.altKey, point, shiftKey: event.shiftKey }, { requestCanvasRender });
      gestureStateRef.current = gesture;
      if (isActiveGesture(gesture)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [requestCanvasRender],
  );

  const continueStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas) return;
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const state = useEditorStore.getState();
      state.setCursorLabel(`x: ${point.x} y: ${point.y}`);
      gestureStateRef.current = updateEditorGesture(
        gestureStateRef.current,
        { altKey: event.altKey, point, shiftKey: event.shiftKey },
        { requestCanvasRender },
      );
    },
    [requestCanvasRender],
  );

  const finishStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas || !isActiveGesture(gestureStateRef.current)) return;

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      gestureStateRef.current = finishEditorGesture(
        gestureStateRef.current,
        { altKey: event.altKey, point, shiftKey: event.shiftKey },
        { requestCanvasRender },
      );
    },
    [requestCanvasRender],
  );

  const cancelStroke = useCallback(() => {
    gestureStateRef.current = cancelEditorGesture(gestureStateRef.current, { requestCanvasRender });
  }, [requestCanvasRender]);

  return useMemo(
    () => ({
      onPointerDown: beginStroke,
      onPointerMove: continueStroke,
      onPointerUp: finishStroke,
      onPointerCancel: cancelStroke,
      onPointerLeave: () => {
        if (!isActiveGesture(gestureStateRef.current)) {
          useEditorStore.getState().setCursorLabel("x: -- y: --");
        }
      },
    }),
    [beginStroke, cancelStroke, continueStroke, finishStroke],
  );
}
