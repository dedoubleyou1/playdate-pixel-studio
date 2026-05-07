import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "./constants";
import type { PixelLayer, Point, Tool } from "./types";

export function indexFor(x: number, y: number): number {
  return y * PLAYDATE_WIDTH + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < PLAYDATE_WIDTH && y >= 0 && y < PLAYDATE_HEIGHT;
}

export function mirroredPoints(x: number, y: number, mirrorX: boolean, mirrorY: boolean): Point[] {
  const points: Point[] = [{ x, y }];
  if (mirrorX) points.push({ x: PLAYDATE_WIDTH - 1 - x, y });
  if (mirrorY) points.push({ x, y: PLAYDATE_HEIGHT - 1 - y });
  if (mirrorX && mirrorY) points.push({ x: PLAYDATE_WIDTH - 1 - x, y: PLAYDATE_HEIGHT - 1 - y });

  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function setPixel(layer: PixelLayer, x: number, y: number, value: 0 | 1): boolean {
  if (!inBounds(x, y)) return false;
  const index = indexFor(x, y);
  if (layer.data[index] === value) return false;
  layer.data[index] = value;
  return true;
}

interface BrushOptions {
  size: number;
  mirrorX: boolean;
  mirrorY: boolean;
  tool: Tool;
}

export function drawBrushAt(layer: PixelLayer, point: Point, options: BrushOptions): boolean {
  const half = Math.floor(options.size / 2);
  let changed = false;

  for (const mirroredPoint of mirroredPoints(point.x, point.y, options.mirrorX, options.mirrorY)) {
    for (let yy = 0; yy < options.size; yy += 1) {
      for (let xx = 0; xx < options.size; xx += 1) {
        const x = mirroredPoint.x + xx - half;
        const y = mirroredPoint.y + yy - half;
        let value: 0 | 1 = options.tool === "eraser" ? 0 : 1;
        if (options.tool === "dither") {
          value = (x + y) % 2 === 0 ? 1 : 0;
        }
        changed = setPixel(layer, x, y, value) || changed;
      }
    }
  }

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
  let changed = false;
  walkLine(start, end, (point) => {
    changed = drawBrushAt(layer, point, options) || changed;
  });
  return changed;
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

export function floodFill(layer: PixelLayer, point: Point, value: 0 | 1): boolean {
  if (!inBounds(point.x, point.y)) return false;
  const startIndex = indexFor(point.x, point.y);
  const target = layer.data[startIndex];
  if (target === value) return false;

  const stack: Point[] = [point];
  let changed = false;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !inBounds(current.x, current.y)) continue;
    const index = indexFor(current.x, current.y);
    if (layer.data[index] !== target) continue;

    layer.data[index] = value;
    changed = true;
    stack.push(
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    );
  }

  return changed;
}
