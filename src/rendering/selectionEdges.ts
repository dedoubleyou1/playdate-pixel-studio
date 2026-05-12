import type { BinaryMaskSurface } from "../domain/types";

export interface SelectionHaloMask {
  width: number;
  height: number;
  data: Uint8Array;
}

export function createSelectionHaloMask(mask: BinaryMaskSurface, cellSize: number): SelectionHaloMask {
  const safeCellSize = Math.max(1, Math.round(cellSize));
  const width = mask.width * safeCellSize + 2;
  const height = mask.height * safeCellSize + 2;
  const data = new Uint8Array(width * height);

  const markPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data[y * width + x] = 1;
  };

  const clearPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data[y * width + x] = 0;
  };

  for (let cellY = 0; cellY < mask.height; cellY += 1) {
    for (let cellX = 0; cellX < mask.width; cellX += 1) {
      if (!maskCell(mask, cellX, cellY)) continue;

      const left = 1 + cellX * safeCellSize;
      const top = 1 + cellY * safeCellSize;
      const right = left + safeCellSize;
      const bottom = top + safeCellSize;

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
    }
  }

  // Side-only halos overlap at inside notches; clear those corner joins so holes stay open.
  clearConcaveInsideCorners(mask, safeCellSize, clearPixel);

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

function clearConcaveInsideCorners(
  mask: BinaryMaskSurface,
  cellSize: number,
  clearPixel: (x: number, y: number) => void,
): void {
  for (let cellY = 0; cellY < mask.height; cellY += 1) {
    for (let cellX = 0; cellX < mask.width; cellX += 1) {
      if (maskCell(mask, cellX, cellY)) continue;

      const left = 1 + cellX * cellSize;
      const top = 1 + cellY * cellSize;
      const right = left + cellSize - 1;
      const bottom = top + cellSize - 1;

      if (maskCell(mask, cellX, cellY - 1) && maskCell(mask, cellX - 1, cellY)) clearPixel(left, top);
      if (maskCell(mask, cellX, cellY - 1) && maskCell(mask, cellX + 1, cellY)) clearPixel(right, top);
      if (maskCell(mask, cellX, cellY + 1) && maskCell(mask, cellX + 1, cellY)) clearPixel(right, bottom);
      if (maskCell(mask, cellX, cellY + 1) && maskCell(mask, cellX - 1, cellY)) clearPixel(left, bottom);
    }
  }
}
