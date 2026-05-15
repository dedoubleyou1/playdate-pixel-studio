import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { renderObjectThumbnail } from "../rendering/compositor";
import { useEditorStore } from "../state/editorStore";
import { selectObjectThumbnailKey } from "./panelSelectors";

export function ObjectPreviewCanvas({
  canvasHeight,
  canvasWidth,
  className,
  objectId,
  objectName,
  style,
}: {
  canvasHeight: number;
  canvasWidth: number;
  className?: string;
  objectId: string;
  objectName: string;
  style?: CSSProperties;
}): React.JSX.Element {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailKey = useStoreWithEqualityFn(useEditorStore, (state) => selectObjectThumbnailKey(state, objectId));

  useEffect(() => {
    const state = useEditorStore.getState();
    const object = state.objects.find((candidate) => candidate.id === objectId);
    if (previewRef.current && object) {
      renderObjectThumbnail(previewRef.current, object, state.palette);
    }
  }, [canvasHeight, canvasWidth, objectId, thumbnailKey]);

  return (
    <canvas
      ref={previewRef}
      className={className}
      height={canvasHeight}
      style={style}
      width={canvasWidth}
      aria-label={`${objectName} preview`}
    />
  );
}
