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
  const pendingSelectionMove = useEditorStore((state) => state.pendingSelectionMove);
  const selectionPreview = useEditorStore((state) => state.selectionPreview);

  return selectionOverlaySource({
    activeSelection,
    height,
    pendingSelectionMove,
    selectionPreview,
    width,
  });
}
