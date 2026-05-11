import type { BinaryMaskSurface } from "../domain/types";

export type SelectionEdgeSide = "top" | "right" | "bottom" | "left";

export interface SelectionEdge {
  side: SelectionEdgeSide;
  x: number;
  y: number;
}

export interface SelectionHaloMask {
  width: number;
  height: number;
  data: Uint8Array;
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

export function createSelectionHaloMask(mask: BinaryMaskSurface, zoom: number): SelectionHaloMask {
  const cellSize = Math.max(1, Math.round(zoom));
  const width = mask.width * cellSize + 2;
  const height = mask.height * cellSize + 2;
  const data = new Uint8Array(width * height);

  const markPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data[y * width + x] = 1;
  };

  for (let cellY = 0; cellY < mask.height; cellY += 1) {
    for (let cellX = 0; cellX < mask.width; cellX += 1) {
      if (!maskCell(mask, cellX, cellY)) continue;

      const left = 1 + cellX * cellSize;
      const top = 1 + cellY * cellSize;
      const right = left + cellSize;
      const bottom = top + cellSize;

      if (!maskCell(mask, cellX, cellY - 1)) {
        for (let x = left; x < right; x += 1) markPixel(x, top - 1);
      }

      if (!maskCell(mask, cellX + 1, cellY)) {
        for (let y = top; y < bottom; y += 1) markPixel(right, y);
      }

      if (!maskCell(mask, cellX, cellY + 1)) {
        for (let x = left; x < right; x += 1) markPixel(x, bottom);
      }

      if (!maskCell(mask, cellX - 1, cellY)) {
        for (let y = top; y < bottom; y += 1) markPixel(left - 1, y);
      }

      if (!maskCell(mask, cellX - 1, cellY - 1)) markPixel(left - 1, top - 1);
      if (!maskCell(mask, cellX + 1, cellY - 1)) markPixel(right, top - 1);
      if (!maskCell(mask, cellX + 1, cellY + 1)) markPixel(right, bottom);
      if (!maskCell(mask, cellX - 1, cellY + 1)) markPixel(left - 1, bottom);
    }
  }

  return { width, height, data };
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
