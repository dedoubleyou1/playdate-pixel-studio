import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { checkerSelectionColorIndex, createSelectionHaloMask } from "../rendering/selectionEdges";
import type { SelectionHaloMask } from "../rendering/selectionEdges";
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
  const cellSize = Math.max(1, Math.round(zoom));
  const haloMask = useMemo(() => (mask ? createSelectionHaloMask(mask, cellSize) : null), [cellSize, mask]);
  const browserWidth = width * cellSize + 2;
  const browserHeight = height * cellSize + 2;

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

    if (!haloMask || browserWidth <= 0 || browserHeight <= 0) return;

    renderSelectionHalo(context, haloMask, {
      checkerCellSize: CHECKER_CELL_CSS_PX,
      offsetX: dx * cellSize,
      offsetY: dy * cellSize,
      phase,
    });
  }, [browserHeight, browserWidth, cellSize, dx, dy, haloMask, phase]);

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
}

function renderSelectionHalo(
  context: CanvasRenderingContext2D,
  haloMask: SelectionHaloMask,
  options: {
    checkerCellSize: number;
    offsetX: number;
    offsetY: number;
    phase: 0 | 1;
  },
): void {
  const canvasWidth = context.canvas.width;
  const canvasHeight = context.canvas.height;

  for (let y = 0; y < haloMask.height; y += 1) {
    for (let x = 0; x < haloMask.width; x += 1) {
      if (!haloMask.data[y * haloMask.width + x]) continue;

      const screenX = x + options.offsetX;
      const screenY = y + options.offsetY;
      if (screenX < 0 || screenY < 0 || screenX >= canvasWidth || screenY >= canvasHeight) continue;

      context.fillStyle =
        SELECTION_COLORS[checkerSelectionColorIndex(screenX, screenY, options.checkerCellSize, options.phase)];
      context.fillRect(screenX, screenY, 1, 1);
    }
  }
}
