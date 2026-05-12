import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "../state/editorStore";

export const DEFAULT_ZOOM = 2;
export const MAX_ZOOM = 6;
export const MIN_ZOOM = 1;

const WHEEL_ZOOM_STEP = 80;

export function useCanvasZoomInput({
  canvasWrap,
  pointerInsideCanvasRef,
}: {
  canvasWrap: HTMLDivElement | null;
  pointerInsideCanvasRef: { current: boolean };
}): {
  maxZoom: number;
  minZoom: number;
  resetWheelZoomDelta: () => void;
  setZoomFromSlider: (value: number | undefined) => void;
  zoom: number;
} {
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const wheelZoomDeltaRef = useRef(0);

  const resetWheelZoomDelta = useCallback(() => {
    wheelZoomDeltaRef.current = 0;
  }, []);

  const adjustZoom = useCallback(
    (direction: -1 | 1) => {
      setZoom(clampCanvasZoom(zoom + direction));
    },
    [setZoom, zoom],
  );

  const setZoomFromSlider = useCallback(
    (value: number | undefined) => {
      setZoom(sliderValueToZoom(value));
    },
    [setZoom],
  );

  useEffect(() => {
    if (!canvasWrap) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      wheelZoomDeltaRef.current += event.deltaY;

      if (Math.abs(wheelZoomDeltaRef.current) < WHEEL_ZOOM_STEP) return;

      adjustZoom(wheelZoomDeltaRef.current < 0 ? 1 : -1);
      wheelZoomDeltaRef.current = 0;
    };

    canvasWrap.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvasWrap.removeEventListener("wheel", handleWheel);
  }, [adjustZoom, canvasWrap]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pointerInsideCanvasRef.current) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        adjustZoom(1);
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        adjustZoom(-1);
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setZoom(DEFAULT_ZOOM);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [adjustZoom, pointerInsideCanvasRef, setZoom]);

  return {
    maxZoom: MAX_ZOOM,
    minZoom: MIN_ZOOM,
    resetWheelZoomDelta,
    setZoomFromSlider,
    zoom,
  };
}

export function clampCanvasZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function sliderValueToZoom(value: number | undefined): number {
  return clampCanvasZoom(value ?? MIN_ZOOM);
}
