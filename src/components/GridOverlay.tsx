import { useEffect, useRef } from "react";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";

const GRID_COLOR = "rgba(40, 87, 184, 0.28)";

export function GridOverlay({ visible, zoom }: { visible: boolean; zoom: number }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cssWidth = PLAYDATE_WIDTH * zoom;
    const cssHeight = PLAYDATE_HEIGHT * zoom;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const context = canvas.getContext("2d");
    if (!context) return;

    const physicalWidth = canvas.width;
    const physicalHeight = canvas.height;
    const physicalCellSize = zoom * dpr;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, physicalWidth, physicalHeight);
    if (!visible) return;

    context.fillStyle = GRID_COLOR;

    for (let column = 1; column < PLAYDATE_WIDTH; column += 1) {
      const x = Math.round(column * physicalCellSize);
      context.fillRect(x, 0, 1, physicalHeight);
    }

    for (let row = 1; row < PLAYDATE_HEIGHT; row += 1) {
      const y = Math.round(row * physicalCellSize);
      context.fillRect(0, y, physicalWidth, 1);
    }
  }, [visible, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className="grid-overlay-canvas"
      aria-hidden="true"
      style={{
        width: `${PLAYDATE_WIDTH * zoom}px`,
        height: `${PLAYDATE_HEIGHT * zoom}px`,
      }}
    />
  );
}
