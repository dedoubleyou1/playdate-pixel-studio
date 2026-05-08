import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { objectThumbnailKey } from "../domain/thumbnailKeys";
import type { ObjectDefinition, ProjectPalette } from "../domain/types";
import { renderObjectThumbnail } from "../rendering/compositor";

export function ObjectPreviewCanvas({
  canvasHeight,
  canvasWidth,
  className,
  object,
  palette,
  thumbnailKey = objectThumbnailKey(object),
  style,
}: {
  canvasHeight?: number;
  canvasWidth?: number;
  className?: string;
  object: ObjectDefinition;
  palette: ProjectPalette;
  thumbnailKey?: string;
  style?: CSSProperties;
}): React.JSX.Element {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const objectRef = useRef(object);

  useEffect(() => {
    objectRef.current = object;
  }, [object]);

  useEffect(() => {
    if (previewRef.current) {
      renderObjectThumbnail(previewRef.current, objectRef.current, palette);
    }
  }, [canvasHeight, canvasWidth, palette, thumbnailKey]);

  return (
    <canvas
      ref={previewRef}
      className={className}
      height={canvasHeight ?? object.height}
      style={style}
      width={canvasWidth ?? object.width}
      aria-label={`${object.name} preview`}
    />
  );
}
