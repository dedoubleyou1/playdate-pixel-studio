import { maskContains } from "./masks";
import { indexFor, inBounds, mirroredPoints, walkEllipseOutline, walkLine, walkRectOutline } from "./pixelGeometry";
import type { BinaryMaskSurface, PaletteIndex, PixelLayer, PixelSurface, PixelValue, Point } from "./types";

export function setPixel(layer: PixelLayer, x: number, y: number, value: PixelValue): boolean {
  return setSurfacePixel(layer.surface, x, y, value);
}

export function setSurfacePixel(surface: PixelSurface, x: number, y: number, value: PixelValue): boolean {
  if (!inBounds(x, y, surface.width, surface.height)) return false;
  const index = indexFor(x, y, surface.width);
  if (surface.data[index] === value) return false;
  surface.data[index] = value;
  return true;
}

export interface BrushOptions {
  paletteIndex: PaletteIndex;
  size: number;
  mirrorX: boolean;
  mirrorY: boolean;
  selectionMask?: BinaryMaskSurface | null;
}

export function drawBrushAt(layer: PixelLayer, point: Point, options: BrushOptions): boolean {
  const half = Math.floor(options.size / 2);
  let changed = false;

  for (const mirroredPoint of mirroredPoints(
    point.x,
    point.y,
    options.mirrorX,
    options.mirrorY,
    layer.surface.width,
    layer.surface.height,
  )) {
    for (let yy = 0; yy < options.size; yy += 1) {
      for (let xx = 0; xx < options.size; xx += 1) {
        const x = mirroredPoint.x + xx - half;
        const y = mirroredPoint.y + yy - half;
        if (!maskContains(options.selectionMask, x, y)) continue;
        changed = setPixel(layer, x, y, options.paletteIndex) || changed;
      }
    }
  }

  return changed;
}

export function drawInterpolatedStroke(layer: PixelLayer, start: Point, end: Point, options: BrushOptions): boolean {
  let changed = false;
  walkLine(start, end, (point) => {
    changed = drawBrushAt(layer, point, options) || changed;
  });
  return changed;
}

export function drawLine(layer: PixelLayer, start: Point, end: Point, options: BrushOptions): boolean {
  return drawInterpolatedStroke(layer, start, end, options);
}

export function drawRect(layer: PixelLayer, start: Point, end: Point, options: BrushOptions): boolean {
  let changed = false;
  walkRectOutline(start, end, (point) => {
    changed = drawBrushAt(layer, point, options) || changed;
  });
  return changed;
}

export function drawEllipse(layer: PixelLayer, start: Point, end: Point, options: BrushOptions): boolean {
  let changed = false;
  walkEllipseOutline(start, end, (point) => {
    changed = drawBrushAt(layer, point, options) || changed;
  });
  return changed;
}

export function floodFill(
  layer: PixelLayer,
  point: Point,
  paletteIndex: PaletteIndex,
  selectionMask?: BinaryMaskSurface | null,
): boolean {
  if (!inBounds(point.x, point.y, layer.surface.width, layer.surface.height)) return false;
  if (!maskContains(selectionMask, point.x, point.y)) return false;
  const startIndex = indexFor(point.x, point.y, layer.surface.width);
  const target = layer.surface.data[startIndex];
  if (target === paletteIndex) return false;

  const stack: Point[] = [point];
  const visited = new Uint8Array(layer.surface.data.length);
  let changed = false;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !inBounds(current.x, current.y, layer.surface.width, layer.surface.height)) continue;
    const index = indexFor(current.x, current.y, layer.surface.width);
    if (visited[index]) continue;
    visited[index] = 1;
    if (!maskContains(selectionMask, current.x, current.y)) continue;
    if (layer.surface.data[index] !== target) continue;

    changed = setSurfacePixel(layer.surface, current.x, current.y, paletteIndex) || changed;
    stack.push(
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    );
  }

  return changed;
}
