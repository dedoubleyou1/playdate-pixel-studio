import { useLayoutEffect, useRef } from "react";
const GRID_COLOR = "rgba(40, 87, 184, 0.28)";

export function GridOverlay({
  visible,
  zoom,
  gridSize,
  width,
  height,
}: {
  visible: boolean;
  zoom: number;
  gridSize: number;
  width: number;
  height: number;
}): React.JSX.Element {
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
      if (!visible || zoom <= 1) return;

      const cellWidth = physicalWidth / width;
      const cellHeight = physicalHeight / height;
      context.fillStyle = GRID_COLOR;

      for (let column = gridSize; column < width; column += gridSize) {
        context.fillRect(Math.round(column * cellWidth), 0, 1, physicalHeight);
      }

      for (let row = gridSize; row < height; row += gridSize) {
        context.fillRect(0, Math.round(row * cellHeight), physicalWidth, 1);
      }
    };

    drawGrid();

    const observer = new ResizeObserver(drawGrid);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [gridSize, height, visible, width, zoom]);

  return <canvas ref={canvasRef} className="grid-overlay-canvas" aria-hidden="true" />;
}
