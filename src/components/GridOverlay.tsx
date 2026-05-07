import { useLayoutEffect, useRef } from "react";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";

const GRID_COLOR = "rgba(40, 87, 184, 0.28)";

export function GridOverlay({ visible, zoom }: { visible: boolean; zoom: number }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawGrid = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const physicalWidth = Math.round(rect.width * dpr);
      const physicalHeight = Math.round(rect.height * dpr);
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, physicalWidth, physicalHeight);
      if (!visible) return;

      const cellWidth = physicalWidth / PLAYDATE_WIDTH;
      const cellHeight = physicalHeight / PLAYDATE_HEIGHT;
      context.fillStyle = GRID_COLOR;

      for (let column = 1; column < PLAYDATE_WIDTH; column += 1) {
        context.fillRect(Math.round(column * cellWidth), 0, 1, physicalHeight);
      }

      for (let row = 1; row < PLAYDATE_HEIGHT; row += 1) {
        context.fillRect(0, Math.round(row * cellHeight), physicalWidth, 1);
      }
    };

    drawGrid();

    const observer = new ResizeObserver(drawGrid);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [visible, zoom]);

  return <canvas ref={canvasRef} className="grid-overlay-canvas" aria-hidden="true" />;
}
