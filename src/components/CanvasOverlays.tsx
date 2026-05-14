import type { CSSProperties, JSX, Ref } from "react";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import type { ObjectDefinition, ProjectPalette } from "../domain/types";
import type { ObjectDropPreview } from "../hooks/useCanvasObjectDrop";
import type { SelectionOverlaySource } from "../rendering/selectionOverlaySource";
import { GridOverlay } from "./GridOverlay";
import { ObjectPreviewCanvas } from "./ObjectPreviewCanvas";
import { SelectionOverlay, type SelectionOverlayHandle } from "./SelectionOverlay";

interface CanvasOverlaysProps {
  gridSize: number;
  gridVisible: boolean;
  height: number;
  objectDropPreview: ObjectDropPreview | null;
  palette: ProjectPalette;
  previewObject: ObjectDefinition | null;
  selectionOverlay: SelectionOverlaySource;
  selectionOverlayRef: Ref<SelectionOverlayHandle>;
  width: number;
  zoom: number;
}

export function CanvasOverlays({
  gridSize,
  gridVisible,
  height,
  objectDropPreview,
  palette,
  previewObject,
  selectionOverlay,
  selectionOverlayRef,
  width,
  zoom,
}: CanvasOverlaysProps): JSX.Element {
  return (
    <>
      <GridOverlay visible={gridVisible} zoom={zoom} gridSize={gridSize} width={width} height={height} />
      <SelectionOverlay ref={selectionOverlayRef} height={height} model={selectionOverlay} width={width} zoom={zoom} />
      {previewObject && objectDropPreview ? (
        <ObjectPreviewCanvas
          className="canvas-object-drop-preview"
          object={previewObject}
          palette={palette}
          thumbnailKey={objectThumbnailKey(previewObject)}
          style={objectDropPreviewStyle(previewObject, objectDropPreview, zoom)}
        />
      ) : null}
    </>
  );
}

function objectDropPreviewStyle(
  object: ObjectDefinition,
  preview: ObjectDropPreview,
  zoom: number,
): CSSProperties {
  return {
    height: `${object.height * zoom}px`,
    left: `${preview.x * zoom}px`,
    top: `${preview.y * zoom}px`,
    width: `${object.width * zoom}px`,
  };
}
