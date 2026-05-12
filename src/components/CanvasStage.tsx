import { useCallback, useRef, useState, type CSSProperties } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { activeStack } from "../domain/layers";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import { useCanvasCursor } from "../hooks/useCanvasCursor";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { useCanvasObjectDrop } from "../hooks/useCanvasObjectDrop";
import { useCanvasZoomInput } from "../hooks/useCanvasZoomInput";
import { useSelectionModifierCursor } from "../hooks/useSelectionModifierCursor";
import { GridOverlay } from "./GridOverlay";
import { EditorBar, EditorBarCenter, EditorBarLeft, EditorBarRight } from "./layout/editor-layout";
import { ObjectContextBar } from "./ObjectContextBar";
import { SelectionOverlay } from "./SelectionOverlay";
import { selectionOverlaySource } from "../rendering/selectionOverlaySource";
import { selectActiveSelection, useEditorStore } from "../state/editorStore";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";

export function CanvasStage(): React.JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canvasWrap, setCanvasWrap] = useState<HTMLDivElement | null>(null);
  const { clearSelectionModifierCursor, hoverSelectionCombineMode, updateSelectionModifierCursor } =
    useSelectionModifierCursor();
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const cursorLabel = useEditorStore((state) => state.cursorLabel);
  const stack = useEditorStore((state) => activeStack(state));
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
  const handlers = useCanvasEditor(canvas);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointerInsideCanvasRef = useRef(false);
  const { maxZoom, minZoom, resetWheelZoomDelta, setZoomFromSlider, zoom } = useCanvasZoomInput({
    canvasWrap,
    pointerInsideCanvasRef,
  });
  const { isDropTarget, objectDropPreview, previewObject, setDropTargetRef } = useCanvasObjectDrop(canvas);

  const setCanvasWrapRef = useCallback(
    (element: HTMLDivElement | null) => {
      wrapRef.current = element;
      setCanvasWrap((current) => (current === element ? current : element));
      setDropTargetRef(element);
    },
    [setDropTargetRef],
  );

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
