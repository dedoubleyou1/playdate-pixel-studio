import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { checkerSelectionColorIndex, exposedSelectionEdges } from "../rendering/selectionEdges";
import type { SelectionEdge } from "../rendering/selectionEdges";
import type { SelectionOverlaySource } from "../rendering/selectionOverlaySource";

const CHECKER_CELL_CSS_PX = 4;
const PHASE_INTERVAL_MS = 260;
const SELECTION_COLORS = ["#7800ff", "#ffffff"] as const;

export function SelectionOverlay({
  height,
  model,
  width,
  zoom,
}: {
  height: number;
  model: SelectionOverlaySource;
  width: number;
  zoom: number;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { dx, dy, mask } = model;
  const [phase, setPhase] = useState<0 | 1>(0);
  const edges = useMemo(() => (mask ? exposedSelectionEdges(mask) : []), [mask]);
  const browserWidth = width * zoom;
  const browserHeight = height * zoom;

  useEffect(() => {
    if (!mask) return;

    const intervalId = window.setInterval(() => {
      setPhase((current) => (current === 0 ? 1 : 0));
    }, PHASE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [mask]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== browserWidth) canvas.width = browserWidth;
    if (canvas.height !== browserHeight) canvas.height = browserHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, browserWidth, browserHeight);

    if (!mask || browserWidth <= 0 || browserHeight <= 0) return;

    renderSelectionEdges(context, edges, {
      cellSize: zoom,
      checkerCellSize: CHECKER_CELL_CSS_PX,
      dx,
      dy,
      phase,
      thickness: 1,
    });
  }, [browserHeight, browserWidth, dx, dy, edges, mask, phase, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="selection-overlay-canvas"
      style={{
        height: `${browserHeight}px`,
        width: `${browserWidth}px`,
      }}
      aria-hidden="true"
    />
  );
}

function renderSelectionEdges(
  context: CanvasRenderingContext2D,
  edges: SelectionEdge[],
  options: {
    cellSize: number;
    checkerCellSize: number;
    dx: number;
    dy: number;
    phase: 0 | 1;
    thickness: number;
  },
): void {
  for (const edge of edges) {
    const cellX = edge.x + options.dx;
    const cellY = edge.y + options.dy;
    let left = cellX * options.cellSize;
    let top = cellY * options.cellSize;
    let right = (cellX + 1) * options.cellSize;
    let bottom = (cellY + 1) * options.cellSize;

    if (edge.side === "top") {
      bottom = top + options.thickness;
    } else if (edge.side === "right") {
      left = right - options.thickness;
    } else if (edge.side === "bottom") {
      top = bottom - options.thickness;
    } else {
      right = left + options.thickness;
    }

    fillCheckerRect(context, left, top, right - left, bottom - top, options.checkerCellSize, options.phase);
  }
}

function fillCheckerRect(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
  checkerCellSize: number,
  phase: 0 | 1,
): void {
  const right = left + width;
  const bottom = top + height;
  const startX = Math.floor(left / checkerCellSize) * checkerCellSize;
  const startY = Math.floor(top / checkerCellSize) * checkerCellSize;

  for (let y = startY; y < bottom; y += checkerCellSize) {
    for (let x = startX; x < right; x += checkerCellSize) {
      const fillLeft = Math.max(left, x);
      const fillTop = Math.max(top, y);
      const fillRight = Math.min(right, x + checkerCellSize);
      const fillBottom = Math.min(bottom, y + checkerCellSize);
      if (fillRight <= fillLeft || fillBottom <= fillTop) continue;
      context.fillStyle = SELECTION_COLORS[checkerSelectionColorIndex(x, y, checkerCellSize, phase)];
      context.fillRect(fillLeft, fillTop, fillRight - fillLeft, fillBottom - fillTop);
    }
  }
}
