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

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    if (!visible) return;

    context.strokeStyle = GRID_COLOR;
    context.lineWidth = 1;
    context.beginPath();

    for (let x = zoom; x < cssWidth; x += zoom) {
      const crispX = Math.round(x) + 0.5;
      context.moveTo(crispX, 0);
      context.lineTo(crispX, cssHeight);
    }

    for (let y = zoom; y < cssHeight; y += zoom) {
      const crispY = Math.round(y) + 0.5;
      context.moveTo(0, crispY);
      context.lineTo(cssWidth, crispY);
    }

    context.stroke();
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
