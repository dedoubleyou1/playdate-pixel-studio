import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { activeLayer, activeStack } from "../domain/layers";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { ObjectContextBar } from "./EditBreadcrumbs";
import { GridOverlay } from "./GridOverlay";
import { useEditorStore } from "../state/editorStore";

const GRID_SIZE_STEPS = [1, 2, 4, 8, 16, 32, 64] as const;

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
  const stack = useEditorStore((state) => activeStack(state));
  const activeContext = useEditorStore((state) => state.activeContext);
  const activeLayerName = useEditorStore((state) => activeLayer(state).name);
  const placeObjectOnRoot = useEditorStore((state) => state.placeObjectOnRoot);
  const handlers = useCanvasEditor(canvas);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    wrapRef.current?.style.setProperty("--zoom", String(zoom));
    wrapRef.current?.style.setProperty("--canvas-width", String(stack.width));
    wrapRef.current?.style.setProperty("--canvas-height", String(stack.height));
  }, [stack.height, stack.width, zoom]);

  const handleObjectDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const objectId = event.dataTransfer.getData("application/x-playdate-object");
    if (!objectId) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    placeObjectOnRoot(objectId, {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * stack.width),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * stack.height),
    });
  };

  return (
    <section className="canvas-stage" aria-label="Pixel art canvas">
      {activeContext.type === "object" ? (
        <div className="canvas-context-bar">
          <ObjectContextBar />
        </div>
      ) : null}
      <div className="canvas-rail">
        <div
          ref={wrapRef}
          className="canvas-wrap"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleObjectDrop}
        >
          <canvas
            id="artCanvas"
            ref={setCanvas}
            width={stack.width}
            height={stack.height}
            onPointerDown={handlers.onPointerDown}
            onPointerMove={handlers.onPointerMove}
            onPointerUp={handlers.onPointerUp}
            onPointerCancel={handlers.onPointerCancel}
            onPointerLeave={handlers.onPointerLeave}
          />
          <GridOverlay
            visible={gridVisible}
            zoom={zoom}
            gridSize={gridSize}
            width={stack.width}
            height={stack.height}
          />
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
                    <span>64px</span>
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
