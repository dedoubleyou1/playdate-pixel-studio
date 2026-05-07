import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { activeLayer } from "../domain/layers";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { GridOverlay } from "./GridOverlay";
import { useEditorStore } from "../state/editorStore";

const GRID_SIZE_STEPS = [1, 2, 4, 8, 16] as const;

export function CanvasStage(): React.JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const setGridVisible = useEditorStore((state) => state.setGridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
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
      <div className="canvas-rail">
        <div ref={wrapRef} className="canvas-wrap">
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
          <GridOverlay visible={gridVisible} zoom={zoom} gridSize={gridSize} />
        </div>
      </div>
      <div className="stage-meta">
        <div className="stage-status">
          <strong>{activeLayerName}</strong>
          <span>{status}</span>
        </div>
        <div className="stage-view-controls" aria-label="Canvas view controls">
          <Label>Zoom</Label>
          <Slider min={1} max={6} step={1} value={[zoom]} onValueChange={([value]) => setZoom(value ?? 1)} />
          <strong>{zoom}x</strong>
          <div className="stage-grid-control">
            <Switch checked={gridVisible} onCheckedChange={setGridVisible} />
            <Label>Grid</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="grid-settings-button" aria-label="Grid settings">
                  <Settings2 />
                  {gridSize}px
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid-settings-popover">
                <div className="grid-settings-header">
                  <strong>Grid Size</strong>
                  <span>{zoom <= 1 ? "Hidden at 1x zoom" : "Visible above 1x zoom"}</span>
                </div>
                <div className="grid-size-slider">
                  <Slider
                    min={0}
                    max={GRID_SIZE_STEPS.length - 1}
                    step={1}
                    value={[GRID_SIZE_STEPS.indexOf(gridSize as (typeof GRID_SIZE_STEPS)[number])]}
                    onValueChange={([value]) => setGridSize(GRID_SIZE_STEPS[value ?? 0])}
                  />
                  <div className="grid-size-readout">
                    <span>1px</span>
                    <strong>{gridSize}px</strong>
                    <span>16px</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="pixel-readout">
          <span>{cursorLabel}</span>
        </div>
      </div>
    </section>
  );
}
