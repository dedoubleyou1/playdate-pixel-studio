import type { JSX, PointerEventHandler } from "react";
import type { useCanvasEditor } from "../hooks/useCanvasEditor";

interface CanvasSurfaceProps {
  cursor: string;
  handlers: ReturnType<typeof useCanvasEditor>;
  height: number;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  setCanvas: (canvas: HTMLCanvasElement | null) => void;
  width: number;
}

export function CanvasSurface({
  cursor,
  handlers,
  height,
  onPointerMove,
  setCanvas,
  width,
}: CanvasSurfaceProps): JSX.Element {
  return (
    <canvas
      id="artCanvas"
      ref={setCanvas}
      style={{ cursor }}
      width={width}
      height={height}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onPointerLeave={handlers.onPointerLeave}
      onContextMenu={handlers.onContextMenu}
    />
  );
}
