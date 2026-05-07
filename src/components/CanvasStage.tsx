import { useCallback, useEffect, useRef, useState } from "react";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { activeLayer, activeStack, isDrawableLayer } from "../domain/layers";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { ObjectContextBar } from "./EditBreadcrumbs";
import { GridOverlay } from "./GridOverlay";
import { useEditorStore } from "../state/editorStore";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

const GRID_SIZE_STEPS = [1, 2, 4, 8, 16, 32, 64] as const;

interface ObjectDropPreview {
  objectId: string;
  x: number;
  y: number;
}

export function CanvasStage(): React.JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [objectDropPreview, setObjectDropPreview] = useState<ObjectDropPreview | null>(null);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const setGridVisible = useEditorStore((state) => state.setGridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const activeTool = useEditorStore((state) => state.activeTool);
  const status = useEditorStore((state) => state.status);
  const cursorLabel = useEditorStore((state) => state.cursorLabel);
  const revision = useEditorStore((state) => state.revision);
  const stack = useEditorStore((state) => activeStack(state));
  const objects = useEditorStore((state) => state.objects);
  const activeContext = useEditorStore((state) => state.activeContext);
  const activeLayerName = useEditorStore((state) => activeLayer(state).name);
  const drawingEnabled = useEditorStore((state) => isDrawableLayer(activeLayer(state)));
  const placeObjectOnRoot = useEditorStore((state) => state.placeObjectOnRoot);
  const handlers = useCanvasEditor(canvas);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const objectDropsEnabled = activeContext.type === "root";
  const { isDropTarget, ref: droppableRef } = useDroppable({
    id: CANVAS_DROP_ID,
    data: { kind: "canvas" },
    disabled: !objectDropsEnabled,
  });

  useEffect(() => {
    wrapRef.current?.style.setProperty("--zoom", String(zoom));
    wrapRef.current?.style.setProperty("--canvas-width", String(stack.width));
    wrapRef.current?.style.setProperty("--canvas-height", String(stack.height));
  }, [stack.height, stack.width, zoom]);

  const setCanvasWrapRef = useCallback(
    (element: HTMLDivElement | null) => {
      wrapRef.current = element;
      droppableRef(element);
    },
    [droppableRef],
  );

  const getDropPreviewFromEvent = useCallback(
    (event: {
      nativeEvent?: Event;
      operation: { source?: { data?: unknown } | null; target?: { id?: unknown } | null };
    }) => {
      if (!objectDropsEnabled) return null;
      if (event.operation.target?.id !== CANVAS_DROP_ID) return null;

      const objectId = getDraggedObjectId(event.operation.source?.data);
      const object = objects.find((candidate) => candidate.id === objectId);
      const coordinates = getClientCoordinates(event.nativeEvent);
      if (!objectId || !object || !coordinates || !canvas) return null;

      const center = getCanvasPixelFromClient(coordinates, canvas, stack.width, stack.height);
      return {
        objectId,
        x: center.x - Math.floor(object.width / 2),
        y: center.y - Math.floor(object.height / 2),
      };
    },
    [canvas, objectDropsEnabled, objects, stack.height, stack.width],
  );

  const previewObject = objectDropPreview
    ? objects.find((candidate) => candidate.id === objectDropPreview.objectId)
    : null;

  useDragDropMonitor({
    onDragStart() {
      setObjectDropPreview(null);
    },
    onDragMove(event) {
      const preview = getDropPreviewFromEvent(event);
      setObjectDropPreview((current) => (previewsEqual(current, preview) ? current : preview));
    },
    onDragEnd(event) {
      const preview = getDropPreviewFromEvent(event) ?? objectDropPreview;
      setObjectDropPreview(null);

      if (!event.canceled && preview) {
        placeObjectOnRoot(preview.objectId, { x: preview.x, y: preview.y });
      }
    },
  });

  return (
    <section className="canvas-stage" aria-label="Pixel art canvas">
      {activeContext.type === "object" ? (
        <div className="canvas-context-bar">
          <ObjectContextBar />
        </div>
      ) : null}
      <div className="canvas-rail">
        <div ref={setCanvasWrapRef} className={`canvas-wrap${isDropTarget ? " is-drop-target" : ""}`}>
          <canvas
            id="artCanvas"
            ref={setCanvas}
            className={`canvas-cursor-${drawingEnabled ? activeTool : "disabled"}`}
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
          {previewObject && objectDropPreview ? (
            <ObjectPreviewCanvas
              className="canvas-object-drop-preview"
              object={previewObject}
              revision={revision}
              style={{
                height: `${previewObject.height * zoom}px`,
                left: `${objectDropPreview.x * zoom}px`,
                top: `${objectDropPreview.y * zoom}px`,
                width: `${previewObject.width * zoom}px`,
              }}
            />
          ) : null}
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

function getCanvasPixelFromClient(
  coordinates: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(width - 1, Math.floor(((coordinates.clientX - rect.left) / rect.width) * width))),
    y: Math.max(0, Math.min(height - 1, Math.floor(((coordinates.clientY - rect.top) / rect.height) * height))),
  };
}

function previewsEqual(left: ObjectDropPreview | null, right: ObjectDropPreview | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.objectId === right.objectId && left.x === right.x && left.y === right.y;
}

function getDraggedObjectId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const objectData = data as { kind?: unknown; objectId?: unknown };
  return objectData.kind === "object" && typeof objectData.objectId === "string" ? objectData.objectId : null;
}

function getClientCoordinates(event: Event | undefined): { clientX: number; clientY: number } | null {
  if (event && "clientX" in event && "clientY" in event) {
    return {
      clientX: Number(event.clientX),
      clientY: Number(event.clientY),
    };
  }

  return null;
}
