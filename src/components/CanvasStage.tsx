import { useCallback, useEffect, useRef, useState } from "react";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { activeLayer, activeStack, isPixelEditableLayer } from "../domain/layers";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { GridOverlay } from "./GridOverlay";
import { EditorBar, EditorBarCenter, EditorBarLeft, EditorBarRight } from "./layout/editor-layout";
import { ObjectContextBar } from "./ObjectContextBar";
import { useEditorStore } from "../state/editorStore";
import { toolCursor } from "../toolCursors";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

const DEFAULT_ZOOM = 2;
const MAX_ZOOM = 6;
const MIN_ZOOM = 1;
const WHEEL_ZOOM_STEP = 80;

interface ObjectDropPreview {
  objectId: string;
  x: number;
  y: number;
}

export function CanvasStage(): React.JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canvasWrap, setCanvasWrap] = useState<HTMLDivElement | null>(null);
  const [objectDropPreview, setObjectDropPreview] = useState<ObjectDropPreview | null>(null);
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const activeTool = useEditorStore((state) => state.activeTool);
  const cursorLabel = useEditorStore((state) => state.cursorLabel);
  const stack = useEditorStore((state) => activeStack(state));
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const activeContext = useEditorStore((state) => state.activeContext);
  const drawingEnabled = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));
  const moveEnabled = useEditorStore((state) => Boolean(activeLayer(state)));
  const canvasCursor =
    activeTool === "move"
      ? moveEnabled
        ? toolCursor(activeTool)
        : "not-allowed"
      : drawingEnabled
        ? toolCursor(activeTool)
        : "not-allowed";
  const placeObjectOnRoot = useEditorStore((state) => state.placeObjectOnRoot);
  const handlers = useCanvasEditor(canvas);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointerInsideCanvasRef = useRef(false);
  const wheelZoomDeltaRef = useRef(0);
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
      setCanvasWrap((current) => (current === element ? current : element));
      droppableRef(element);
    },
    [droppableRef],
  );

  const adjustZoom = useCallback(
    (direction: -1 | 1) => {
      setZoom(clampZoom(zoom + direction));
    },
    [setZoom, zoom],
  );

  useEffect(() => {
    if (!canvasWrap) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      wheelZoomDeltaRef.current += event.deltaY;

      if (Math.abs(wheelZoomDeltaRef.current) < WHEEL_ZOOM_STEP) return;

      adjustZoom(wheelZoomDeltaRef.current < 0 ? 1 : -1);
      wheelZoomDeltaRef.current = 0;
    };

    canvasWrap.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvasWrap.removeEventListener("wheel", handleWheel);
  }, [adjustZoom, canvasWrap]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!pointerInsideCanvasRef.current) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        adjustZoom(1);
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        adjustZoom(-1);
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        setZoom(DEFAULT_ZOOM);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [adjustZoom, setZoom]);

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
      {activeContext.type === "object" ? <ObjectContextBar /> : null}
      <div className="canvas-rail">
        <div
          ref={setCanvasWrapRef}
          className={`canvas-wrap${isDropTarget ? " is-drop-target" : ""}`}
          onPointerEnter={() => {
            pointerInsideCanvasRef.current = true;
          }}
          onPointerLeave={() => {
            pointerInsideCanvasRef.current = false;
            wheelZoomDeltaRef.current = 0;
          }}
        >
          <canvas
            id="artCanvas"
            ref={setCanvas}
            style={{ cursor: canvasCursor }}
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
              palette={palette}
              thumbnailKey={objectThumbnailKey(previewObject)}
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
      <EditorBar className="[grid-area:meta] h-(--stage-meta-height) min-h-(--stage-meta-height) border-t border-border border-b-0 max-[980px]:h-auto max-[980px]:grid-cols-1 max-[980px]:items-stretch max-[980px]:px-4 max-[980px]:py-3">
        <EditorBarLeft
          className="grid grid-cols-[auto_minmax(120px,1fr)_36px] items-center gap-3"
          aria-label="Canvas view controls"
        >
          <Label>Zoom</Label>
          <Slider
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            value={[zoom]}
            onValueChange={([value]) => setZoom(clampZoom(value ?? MIN_ZOOM))}
          />
          <strong className="text-right text-xs">{zoom}x</strong>
        </EditorBarLeft>
        <EditorBarCenter aria-hidden="true" />
        <EditorBarRight className="min-w-[110px] text-right max-[980px]:justify-start max-[980px]:text-left">
          <span className="text-xs text-muted-foreground">{cursorLabel}</span>
        </EditorBarRight>
      </EditorBar>
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

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
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
