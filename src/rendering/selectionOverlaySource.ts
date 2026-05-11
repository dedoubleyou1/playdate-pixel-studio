import { createEllipseMask, createRectMask } from "../domain/masks";
import type { BinaryMaskSurface, SelectionPreview, SelectionState } from "../domain/types";

export interface SelectionOverlaySource {
  dx: number;
  dy: number;
  mask: BinaryMaskSurface | null;
}

export function selectionOverlaySource({
  activeSelection,
  height,
  pendingSelectionMove,
  selectionPreview,
  width,
}: {
  activeSelection: SelectionState | null;
  height: number;
  pendingSelectionMove: { dx: number; dy: number; floating: { mask: BinaryMaskSurface } } | null;
  selectionPreview: SelectionPreview | null;
  width: number;
}): SelectionOverlaySource {
  if (selectionPreview) {
    return {
      dx: 0,
      dy: 0,
      mask:
        selectionPreview.type === "ellipse"
          ? createEllipseMask(width, height, selectionPreview.start, selectionPreview.end)
          : createRectMask(width, height, selectionPreview.start, selectionPreview.end),
    };
  }

  if (pendingSelectionMove) {
    return {
      dx: pendingSelectionMove.dx,
      dy: pendingSelectionMove.dy,
      mask: pendingSelectionMove.floating.mask,
    };
  }

  return {
    dx: 0,
    dy: 0,
    mask: activeSelection?.mask ?? null,
  };
}
