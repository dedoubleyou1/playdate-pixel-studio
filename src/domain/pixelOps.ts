import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "./constants";
import type { PaletteIndex, PixelLayer, PixelSurface, PixelValue, Point } from "./types";

export function indexFor(x: number, y: number, width = PLAYDATE_WIDTH): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, width = PLAYDATE_WIDTH, height = PLAYDATE_HEIGHT): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function mirroredPoints(
  x: number,
  y: number,
  mirrorX: boolean,
  mirrorY: boolean,
  width = PLAYDATE_WIDTH,
  height = PLAYDATE_HEIGHT,
): Point[] {
  const points: Point[] = [{ x, y }];
  if (mirrorX) points.push({ x: width - 1 - x, y });
  if (mirrorY) points.push({ x, y: height - 1 - y });
  if (mirrorX && mirrorY) points.push({ x: width - 1 - x, y: height - 1 - y });

  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

export function walkLine(start: Point, end: Point, callback: (point: Point) => void): void {
  let x = start.x;
  let y = start.y;
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const sx = start.x < end.x ? 1 : -1;
  const sy = start.y < end.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    callback({ x, y });
    if (x === end.x && y === end.y) break;
    const doubledError = error * 2;
    if (doubledError > -dy) {
      error -= dy;
      x += sx;
    }
    if (doubledError < dx) {
      error += dx;
      y += sy;
    }
  }
}

export function drawLine(layer: PixelLayer, start: Point, end: Point, options: BrushOptions): boolean {
  return drawInterpolatedStroke(layer, start, end, options);
}

export function drawRect(layer: PixelLayer, start: Point, end: Point, options: BrushOptions): boolean {
  let changed = false;
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  for (let x = left; x <= right; x += 1) {
    changed = drawBrushAt(layer, { x, y: top }, options) || changed;
    changed = drawBrushAt(layer, { x, y: bottom }, options) || changed;
  }

  for (let y = top; y <= bottom; y += 1) {
    changed = drawBrushAt(layer, { x: left, y }, options) || changed;
    changed = drawBrushAt(layer, { x: right, y }, options) || changed;
  }

  return changed;
}

export function floodFill(layer: PixelLayer, point: Point, paletteIndex: PaletteIndex): boolean {
  if (!inBounds(point.x, point.y, layer.surface.width, layer.surface.height)) return false;
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
