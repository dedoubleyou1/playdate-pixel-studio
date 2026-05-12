import { useCallback, useRef, useState, type CSSProperties } from "react";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { CANVAS_DROP_ID } from "../dragDropIds";
import { activeStack } from "../domain/layers";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import { useCanvasCursor } from "../hooks/useCanvasCursor";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { useCanvasZoomInput } from "../hooks/useCanvasZoomInput";
import { useSelectionModifierCursor } from "../hooks/useSelectionModifierCursor";
import { GridOverlay } from "./GridOverlay";
import { EditorBar, EditorBarCenter, EditorBarLeft, EditorBarRight } from "./layout/editor-layout";
import { ObjectContextBar } from "./ObjectContextBar";
import { SelectionOverlay } from "./SelectionOverlay";
import { selectionOverlaySource } from "../rendering/selectionOverlaySource";
import { selectActiveSelection, useEditorStore } from "../state/editorStore";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

interface ObjectDropPreview {
  objectId: string;
  x: number;
  y: number;
}

export function CanvasStage(): React.JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canvasWrap, setCanvasWrap] = useState<HTMLDivElement | null>(null);
  const [objectDropPreview, setObjectDropPreview] = useState<ObjectDropPreview | null>(null);
  const { clearSelectionModifierCursor, hoverSelectionCombineMode, updateSelectionModifierCursor } =
    useSelectionModifierCursor();
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const cursorLabel = useEditorStore((state) => state.cursorLabel);
  const stack = useEditorStore((state) => activeStack(state));
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const activeContext = useEditorStore((state) => state.activeContext);
  const activeSelection = useEditorStore(selectActiveSelection);
  const pendingSelectionMove = useEditorStore((state) => state.pendingSelectionMove);
  const selectionPreview = useEditorStore((state) => state.selectionPreview);
  const selectionOverlay = selectionOverlaySource({
    activeSelection,
    height: stack.height,
    pendingSelectionMove,
    selectionPreview,
    width: stack.width,
  });
  const canvasCursor = useCanvasCursor(hoverSelectionCombineMode);
  const placeObjectOnRoot = useEditorStore((state) => state.placeObjectOnRoot);
  const handlers = useCanvasEditor(canvas);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointerInsideCanvasRef = useRef(false);
  const { maxZoom, minZoom, resetWheelZoomDelta, setZoomFromSlider, zoom } = useCanvasZoomInput({
    canvasWrap,
    pointerInsideCanvasRef,
  });
  const objectDropsEnabled = activeContext.type === "root";
  const { isDropTarget, ref: droppableRef } = useDroppable({
    id: CANVAS_DROP_ID,
    accept: "object",
    type: "canvas",
    data: { kind: "canvas" },
    disabled: !objectDropsEnabled,
  });

  const setCanvasWrapRef = useCallback(
    (element: HTMLDivElement | null) => {
      wrapRef.current = element;
      setCanvasWrap((current) => (current === element ? current : element));
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

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      updateSelectionModifierCursor(event);
      handlers.onPointerMove(event);
    },
    [handlers, updateSelectionModifierCursor],
  );

  return (
    <section className="canvas-stage" aria-label="Pixel art canvas">
      {activeContext.type === "object" ? <ObjectContextBar /> : null}
      <div className="canvas-rail">
        <div
          ref={setCanvasWrapRef}
          className={`canvas-wrap${isDropTarget ? " is-drop-target" : ""}`}
          style={{
            "--canvas-height": stack.height,
            "--canvas-width": stack.width,
            "--zoom": zoom,
          } as CSSProperties}
          onPointerEnter={(event) => {
            pointerInsideCanvasRef.current = true;
            updateSelectionModifierCursor(event);
          }}
          onPointerLeave={() => {
            pointerInsideCanvasRef.current = false;
            resetWheelZoomDelta();
            clearSelectionModifierCursor();
          }}
        >
          <canvas
            id="artCanvas"
            ref={setCanvas}
            style={{ cursor: canvasCursor }}
            width={stack.width}
            height={stack.height}
            onPointerDown={handlers.onPointerDown}
            onPointerMove={handlePointerMove}
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
          <SelectionOverlay
            height={stack.height}
            model={selectionOverlay}
            width={stack.width}
            zoom={zoom}
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
            min={minZoom}
            max={maxZoom}
            step={1}
            value={[zoom]}
            onValueChange={([value]) => setZoomFromSlider(value)}
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
