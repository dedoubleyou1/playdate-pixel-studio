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
}: {
  height: number;
  model: SelectionOverlaySource;
  width: number;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { dx, dy, mask } = model;
  const [phase, setPhase] = useState<0 | 1>(0);
  const edges = useMemo(() => (mask ? exposedSelectionEdges(mask) : []), [mask]);

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

    const observer = new ResizeObserver(() => render());

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const browserWidth = Math.round(rect.width);
      const browserHeight = Math.round(rect.height);
      if (canvas.width !== browserWidth) canvas.width = browserWidth;
      if (canvas.height !== browserHeight) canvas.height = browserHeight;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, browserWidth, browserHeight);

      if (!mask || browserWidth <= 0 || browserHeight <= 0) return;

      renderSelectionEdges(context, edges, {
        cellHeight: browserHeight / height,
        cellWidth: browserWidth / width,
        checkerCellSize: CHECKER_CELL_CSS_PX,
        dx,
        dy,
        phase,
        thickness: 1,
      });
    };

    render();
    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [dx, dy, edges, height, mask, phase, width]);

  return <canvas ref={canvasRef} className="selection-overlay-canvas" aria-hidden="true" />;
}

function renderSelectionEdges(
  context: CanvasRenderingContext2D,
  edges: SelectionEdge[],
  options: {
    cellHeight: number;
    cellWidth: number;
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
    let left = Math.round(cellX * options.cellWidth);
    let top = Math.round(cellY * options.cellHeight);
    let right = Math.round((cellX + 1) * options.cellWidth);
    let bottom = Math.round((cellY + 1) * options.cellHeight);

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
