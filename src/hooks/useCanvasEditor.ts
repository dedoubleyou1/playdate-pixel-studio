import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  activeLayerStackSelector,
  beginEditorGesture,
  cancelEditorGesture,
  clearEditorGestureActivity,
  finishEditorGesture,
  updateEditorGesture,
} from "../input/gestureController";
import { activeStack } from "../domain/layers";
import { EditorCanvas } from "../rendering/editorCanvas";
import type { SelectionOverlayHandle } from "../components/SelectionOverlay";
import { effectiveColorizedPatternsVisible, useEditorStore } from "../state/editorStore";
import {
  idleGestureState,
  isActiveGesture,
  type CanvasRenderRequest,
  type EditorGestureState,
} from "../input/gestureTypes";
import type { SelectionOverlaySource } from "../rendering/selectionOverlaySource";
import { CanvasPointerSession, suppressCanvasContextMenu } from "../input/canvasPointerSession";

export function useCanvasEditor(
  canvas: HTMLCanvasElement | null,
  selectionOverlayRef: RefObject<SelectionOverlayHandle | null>,
): {
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLCanvasElement>) => void;
} {
  const editorCanvasRef = useRef<EditorCanvas | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const renderRequestRef = useRef<CanvasRenderRequest>({});
  const selectionOverlayFrameRef = useRef<number | null>(null);
  const selectionOverlayModelRef = useRef<SelectionOverlaySource | null>(null);
  const gestureStateRef = useRef<EditorGestureState>(idleGestureState);
  const [pointerSession] = useState(() => new CanvasPointerSession());

  const stack = useEditorStore((state) => activeLayerStackSelector(state));
  const viewRevision = useEditorStore((state) => state.viewRevision);

  const renderCanvasNow = useCallback((request: CanvasRenderRequest = {}) => {
    const current = useEditorStore.getState();
    const currentStack = activeStack(current);
    editorCanvasRef.current?.render({
      activeLayerIndex: currentStack.activeLayerIndex,
      background: currentStack.background,
      colorizedPatterns: effectiveColorizedPatternsVisible(current),
      editTarget: current.editTarget,
      layers: currentStack.layers,
      movePreview: request.layerMovePreview ?? null,
      objects: current.objects,
      palette: current.palette,
      preview: current.canvasToolPreview,
      selectionMovePreview: request.selectionMovePreview ?? null,
    });
  }, []);

  useLayoutEffect(() => {
    editorCanvasRef.current = canvas ? new EditorCanvas(canvas, stack.width, stack.height) : null;
    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
      renderRequestRef.current = {};
    }
    renderCanvasNow();
  }, [canvas, renderCanvasNow, stack.height, stack.width, viewRevision]);

  const requestCanvasRender = useCallback(
    (request: CanvasRenderRequest = {}) => {
      renderRequestRef.current = request;
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
      renderFrameRef.current = window.requestAnimationFrame(() => {
        renderCanvasNow(renderRequestRef.current);
        renderFrameRef.current = null;
        renderRequestRef.current = {};
      });
    },
    [renderCanvasNow],
  );

  const requestSelectionOverlayRender = useCallback(
    (model: SelectionOverlaySource | null) => {
      selectionOverlayModelRef.current = model;
      if (selectionOverlayFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionOverlayFrameRef.current);
      }
      selectionOverlayFrameRef.current = window.requestAnimationFrame(() => {
        selectionOverlayRef.current?.renderTransient(selectionOverlayModelRef.current);
        selectionOverlayFrameRef.current = null;
      });
    },
    [selectionOverlayRef],
  );

  useEffect(() => {
    return () => {
      gestureStateRef.current = cancelEditorGesture(gestureStateRef.current, {
        requestCanvasRender,
        requestSelectionOverlayRender,
      });
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      if (selectionOverlayFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionOverlayFrameRef.current);
        selectionOverlayFrameRef.current = null;
      }
      gestureStateRef.current = idleGestureState;
      clearEditorGestureActivity();
    };
  }, [requestCanvasRender, requestSelectionOverlayRender]);

  const beginStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas || !pointerSession.begin(event)) return;

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const gesture = beginEditorGesture(
        { altKey: event.altKey, point, shiftKey: event.shiftKey },
        { requestCanvasRender, requestSelectionOverlayRender },
      );
      gestureStateRef.current = gesture;
      if (isActiveGesture(gesture)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      } else {
        pointerSession.end(event.pointerId);
      }
    },
    [pointerSession, requestCanvasRender, requestSelectionOverlayRender],
  );

  const continueStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!editorCanvas || !pointerSession.acceptsMove(event.pointerId)) return;
      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      const state = useEditorStore.getState();
      state.setCursorLabel(`x: ${point.x} y: ${point.y}`);
      gestureStateRef.current = updateEditorGesture(
        gestureStateRef.current,
        { altKey: event.altKey, point, shiftKey: event.shiftKey },
        { requestCanvasRender, requestSelectionOverlayRender },
      );
    },
    [pointerSession, requestCanvasRender, requestSelectionOverlayRender],
  );

  const finishStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const editorCanvas = editorCanvasRef.current;
      if (!pointerSession.owns(event.pointerId)) return;
      if (!editorCanvas || !isActiveGesture(gestureStateRef.current)) {
        pointerSession.end(event.pointerId);
        return;
      }

      const point = editorCanvas.pointerToPixel(event.nativeEvent);
      gestureStateRef.current = finishEditorGesture(
        gestureStateRef.current,
        { altKey: event.altKey, point, shiftKey: event.shiftKey },
        { requestCanvasRender, requestSelectionOverlayRender },
      );
      pointerSession.end(event.pointerId);
    },
    [pointerSession, requestCanvasRender, requestSelectionOverlayRender],
  );

  const cancelStroke = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerSession.owns(event.pointerId)) return;
      gestureStateRef.current = cancelEditorGesture(gestureStateRef.current, {
        requestCanvasRender,
        requestSelectionOverlayRender,
      });
      pointerSession.end(event.pointerId);
    },
    [pointerSession, requestCanvasRender, requestSelectionOverlayRender],
  );

  return useMemo(
    () => ({
      onPointerDown: beginStroke,
      onPointerMove: continueStroke,
      onPointerUp: finishStroke,
      onPointerCancel: cancelStroke,
      onContextMenu: suppressCanvasContextMenu,
      onPointerLeave: () => {
        if (!isActiveGesture(gestureStateRef.current)) {
          useEditorStore.getState().setCursorLabel("x: -- y: --");
        }
      },
    }),
    [beginStroke, cancelStroke, continueStroke, finishStroke],
  );
}
