import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type JSX } from "react";
import { traceSelectionBoundaryPaths } from "../rendering/selectionEdges";
import type { SelectionBoundaryPath } from "../rendering/selectionEdges";
import type { SelectionOverlaySource } from "../rendering/selectionOverlaySource";

const DASH_LENGTH = 4;
const DASH_INTERVAL_MS = 120;
const SELECTION_COLORS = ["#7800ff", "#ffffff"] as const;

export interface SelectionOverlayHandle {
  renderTransient: (model: SelectionOverlaySource | null) => void;
}

interface SelectionOverlayProps {
  height: number;
  model: SelectionOverlaySource;
  width: number;
  zoom: number;
}

export const SelectionOverlay = forwardRef<SelectionOverlayHandle, SelectionOverlayProps>(function SelectionOverlay(
  {
    height,
    model,
    width,
    zoom,
  },
  ref,
): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const committedModelRef = useRef(model);
  const transientModelRef = useRef<SelectionOverlaySource | null>(null);
  const dashOffsetRef = useRef(0);
  const hasDrawableSelectionRef = useRef(false);
  const cellSize = Math.max(1, Math.round(zoom));
  const browserWidth = width * cellSize + 2;
  const browserHeight = height * cellSize + 2;

  const renderModel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== browserWidth) canvas.width = browserWidth;
    if (canvas.height !== browserHeight) canvas.height = browserHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, browserWidth, browserHeight);

    const { dx, dy, mask } = transientModelRef.current ?? committedModelRef.current;
    const paths = mask ? traceSelectionBoundaryPaths(mask, cellSize) : [];
    hasDrawableSelectionRef.current = paths.length > 0;
    if (paths.length === 0 || browserWidth <= 0 || browserHeight <= 0) return;

    renderSelectionPaths(context, paths, {
      dashOffset: dashOffsetRef.current,
      offsetX: dx * cellSize,
      offsetY: dy * cellSize,
    });
  }, [browserHeight, browserWidth, cellSize]);

  useImperativeHandle(
    ref,
    () => ({
      renderTransient: (nextModel) => {
        transientModelRef.current = nextModel;
        renderModel();
      },
    }),
    [renderModel],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      dashOffsetRef.current = (dashOffsetRef.current + 1) % (DASH_LENGTH * 2);
      if (hasDrawableSelectionRef.current) renderModel();
    }, DASH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [renderModel]);

  useLayoutEffect(() => {
    committedModelRef.current = model;
    transientModelRef.current = null;
    renderModel();
  }, [model, renderModel]);

  return (
    <canvas
      ref={canvasRef}
      className="selection-overlay-canvas"
      style={{
        height: `${browserHeight}px`,
        left: "-1px",
        right: "auto",
        bottom: "auto",
        top: "-1px",
        width: `${browserWidth}px`,
      }}
      aria-hidden="true"
    />
  );
});

function renderSelectionPaths(
  context: CanvasRenderingContext2D,
  paths: SelectionBoundaryPath[],
  options: {
    dashOffset: number;
    offsetX: number;
    offsetY: number;
  },
): void {
  context.save();
  context.translate(options.offsetX, options.offsetY);
  context.lineWidth = 1;
  context.lineCap = "butt";
  context.lineJoin = "miter";
  context.miterLimit = 2;
  context.setLineDash([DASH_LENGTH, DASH_LENGTH]);

  strokeSelectionPaths(context, paths, SELECTION_COLORS[0], -options.dashOffset);
  strokeSelectionPaths(context, paths, SELECTION_COLORS[1], DASH_LENGTH - options.dashOffset);
  context.restore();
}

function strokeSelectionPaths(
  context: CanvasRenderingContext2D,
  paths: SelectionBoundaryPath[],
  color: string,
  dashOffset: number,
): void {
  context.strokeStyle = color;
  context.lineDashOffset = dashOffset;

  for (const path of paths) {
    const [firstPoint, ...remainingPoints] = path.points;
    if (!firstPoint) continue;
    context.beginPath();
    context.moveTo(firstPoint.x, firstPoint.y);
    for (const point of remainingPoints) {
      context.lineTo(point.x, point.y);
    }
    context.closePath();
    context.stroke();
  }
}
