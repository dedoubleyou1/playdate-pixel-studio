import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { ObjectDefinition } from "../domain/types";
import { renderObjectThumbnail } from "../rendering/compositor";

export function ObjectPreviewCanvas({
  canvasHeight,
  canvasWidth,
  className,
  object,
  revision,
  style,
}: {
  canvasHeight?: number;
  canvasWidth?: number;
  className?: string;
  object: ObjectDefinition;
  revision?: number;
  style?: CSSProperties;
}): React.JSX.Element {
  const previewRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (previewRef.current) {
      renderObjectThumbnail(previewRef.current, object);
    }
  }, [object, revision]);

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
