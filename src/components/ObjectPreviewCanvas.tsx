import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { ObjectDefinition } from "../domain/types";
import { renderObjectThumbnail } from "../rendering/compositor";

export function ObjectPreviewCanvas({
  className,
  object,
  revision,
  style,
}: {
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
      height={object.height}
      style={style}
      width={object.width}
      aria-label={`${object.name} preview`}
    />
  );
}
