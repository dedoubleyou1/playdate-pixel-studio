import { useCallback, useRef, useState, type CSSProperties, type JSX, type PointerEvent } from "react";
import { activeStack } from "../domain/layers";
import { useCanvasCursor } from "../hooks/useCanvasCursor";
import { useCanvasEditor } from "../hooks/useCanvasEditor";
import { useCanvasObjectDrop } from "../hooks/useCanvasObjectDrop";
import { useCanvasSelectionOverlay } from "../hooks/useCanvasSelectionOverlay";
import { useCanvasZoomInput } from "../hooks/useCanvasZoomInput";
import { useSelectionModifierCursor } from "../hooks/useSelectionModifierCursor";
import { CanvasOverlays } from "./CanvasOverlays";
import { CanvasSurface } from "./CanvasSurface";
import type { SelectionOverlayHandle } from "./SelectionOverlay";
import { ObjectContextBar } from "./ObjectContextBar";
import { StageFooter } from "./StageFooter";
import { useEditorStore } from "../state/editorStore";

export function CanvasStage(): JSX.Element {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [canvasWrap, setCanvasWrap] = useState<HTMLDivElement | null>(null);
  const selectionOverlayRef = useRef<SelectionOverlayHandle | null>(null);
  const { clearSelectionModifierCursor, hoverSelectionCombineMode, updateSelectionModifierCursor } =
    useSelectionModifierCursor();
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const gridSize = useEditorStore((state) => state.gridSize);
  const cursorLabel = useEditorStore((state) => state.cursorLabel);
  const stack = useEditorStore((state) => activeStack(state));
  const palette = useEditorStore((state) => state.palette);
  const activeContext = useEditorStore((state) => state.activeContext);
  const selectionOverlay = useCanvasSelectionOverlay({ height: stack.height, width: stack.width });
  const canvasCursor = useCanvasCursor(hoverSelectionCombineMode);
  const handlers = useCanvasEditor(canvas, selectionOverlayRef);
  const pointerInsideCanvasRef = useRef(false);
  const { maxZoom, minZoom, resetWheelZoomDelta, setZoomFromSlider, zoom } = useCanvasZoomInput({
    canvasWrap,
    pointerInsideCanvasRef,
  });
  const { isDropTarget, objectDropPreview, previewObject, setDropTargetRef } = useCanvasObjectDrop(canvas);

  const setCanvasWrapRef = useCallback(
    (element: HTMLDivElement | null) => {
      setCanvasWrap((current) => (current === element ? current : element));
      setDropTargetRef(element);
    },
    [setDropTargetRef],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
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
          <CanvasSurface
            cursor={canvasCursor}
            handlers={handlers}
            height={stack.height}
            onPointerMove={handlePointerMove}
            setCanvas={setCanvas}
            width={stack.width}
          />
          <CanvasOverlays
            height={stack.height}
            width={stack.width}
            gridVisible={gridVisible}
            gridSize={gridSize}
            objectDropPreview={objectDropPreview}
            palette={palette}
            previewObject={previewObject}
            selectionOverlay={selectionOverlay}
            selectionOverlayRef={selectionOverlayRef}
            zoom={zoom}
          />
        </div>
      </div>
      <StageFooter
        cursorLabel={cursorLabel}
        maxZoom={maxZoom}
        minZoom={minZoom}
        setZoomFromSlider={setZoomFromSlider}
        zoom={zoom}
      />
    </section>
  );
}
