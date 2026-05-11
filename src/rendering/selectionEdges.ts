import type { BinaryMaskSurface } from "../domain/types";

export type SelectionEdgeSide = "top" | "right" | "bottom" | "left";

export interface SelectionEdge {
  side: SelectionEdgeSide;
  x: number;
  y: number;
}

export function exposedSelectionEdges(mask: BinaryMaskSurface): SelectionEdge[] {
  const edges: SelectionEdge[] = [];

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!maskCell(mask, x, y)) continue;
      if (!maskCell(mask, x, y - 1)) edges.push({ side: "top", x, y });
      if (!maskCell(mask, x + 1, y)) edges.push({ side: "right", x, y });
      if (!maskCell(mask, x, y + 1)) edges.push({ side: "bottom", x, y });
      if (!maskCell(mask, x - 1, y)) edges.push({ side: "left", x, y });
    }
  }

  return edges;
}

export function checkerSelectionColorIndex(screenX: number, screenY: number, cellSize: number, phase: 0 | 1): 0 | 1 {
  const safeCellSize = Math.max(1, Math.floor(cellSize));
  const value = Math.floor(screenX / safeCellSize) + Math.floor(screenY / safeCellSize) + phase;
  return (((value % 2) + 2) % 2) as 0 | 1;
}

function maskCell(mask: BinaryMaskSurface, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  return mask.data[y * mask.width + x] === 1;
}
