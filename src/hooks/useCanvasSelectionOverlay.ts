import { useMemo } from "react";
import { selectionOverlaySource, type SelectionOverlaySource } from "../rendering/selectionOverlaySource";
import { selectActiveSelection, useEditorStore } from "../state/editorStore";

export function useCanvasSelectionOverlay({
  height,
  width,
}: {
  height: number;
  width: number;
}): SelectionOverlaySource {
  const activeSelection = useEditorStore(selectActiveSelection);

  return useMemo(
    () =>
      selectionOverlaySource({
        activeSelection,
        height,
        pendingSelectionMove: null,
        selectionPreview: null,
        width,
      }),
    [activeSelection, height, width],
  );
}
