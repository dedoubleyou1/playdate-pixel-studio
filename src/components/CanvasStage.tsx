import { useEffect, useRef, useState } from "react";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { activeLayer } from "../domain/layers";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { useEditorStore } from "../state/editorStore";

export function CanvasStage(): React.JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const zoom = useEditorStore((state) => state.zoom);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const status = useEditorStore((state) => state.status);
  const cursorLabel = useEditorStore((state) => state.cursorLabel);
  const activeLayerName = useEditorStore((state) => activeLayer(state).name);
  const handlers = useCanvasEditor(canvas);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    wrapRef.current?.style.setProperty("--zoom", String(zoom));
  }, [zoom]);

  return (
    <section className="canvas-stage" aria-label="Pixel art canvas">
      <div className="stage-meta">
        <div>
          <strong>{activeLayerName}</strong>
          <span>{status}</span>
        </div>
        <div className="pixel-readout">
          <span>{cursorLabel}</span>
        </div>
      </div>
      <div className="canvas-rail">
        <div ref={wrapRef} className={`canvas-wrap${gridVisible ? " has-grid" : ""}`}>
          <canvas
            id="artCanvas"
            ref={setCanvas}
            width={PLAYDATE_WIDTH}
            height={PLAYDATE_HEIGHT}
            onPointerDown={handlers.onPointerDown}
            onPointerMove={handlers.onPointerMove}
            onPointerUp={handlers.onPointerUp}
            onPointerCancel={handlers.onPointerCancel}
            onPointerLeave={handlers.onPointerLeave}
          />
        </div>
      </div>
    </section>
  );
}
