import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "./constants";
import type { Point } from "./types";

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

export function walkRectOutline(start: Point, end: Point, callback: (point: Point) => void): void {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  const emit = dedupedEmitter(callback);
  for (let x = left; x <= right; x += 1) {
    emit(x, top);
    emit(x, bottom);
  }
  for (let y = top; y <= bottom; y += 1) {
    emit(left, y);
    emit(right, y);
  }
}

export function walkEllipseOutline(start: Point, end: Point, callback: (point: Point) => void): void {
  let x0 = Math.min(start.x, end.x);
  let x1 = Math.max(start.x, end.x);
  let y0 = Math.min(start.y, end.y);
  let y1 = Math.max(start.y, end.y);
  const width = x1 - x0;
  const height = y1 - y0;

  if (width === 0 || height === 0) {
    walkLine(start, end, callback);
    return;
  }

  const emit = dedupedEmitter(callback);
  const oddHeight = height & 1;
  let dx = 4 * (1 - width) * height * height;
  let dy = 4 * (oddHeight + 1) * width * width;
  let error = dx + dy + oddHeight * width * width;

  y0 += Math.floor((height + 1) / 2);
  y1 = y0 - oddHeight;
  const widthStep = 8 * width * width;
  const heightStep = 8 * height * height;

  do {
    emit(x1, y0);
    emit(x0, y0);
    emit(x0, y1);
    emit(x1, y1);

    const doubledError = 2 * error;
    if (doubledError <= dy) {
      y0 += 1;
      y1 -= 1;
      dy += widthStep;
      error += dy;
    }
    if (doubledError >= dx || 2 * error > dy) {
      x0 += 1;
      x1 -= 1;
      dx += heightStep;
      error += dx;
    }
  } while (x0 <= x1);

  while (y0 - y1 < height) {
    emit(x0 - 1, y0);
    emit(x1 + 1, y0);
    y0 += 1;
    emit(x0 - 1, y1);
    emit(x1 + 1, y1);
    y1 -= 1;
  }
}

export function walkFilledEllipseSpans(
  start: Point,
  end: Point,
  callback: (span: { y: number; left: number; right: number }) => void,
): void {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  if (right <= left || bottom <= top) {
    for (let y = top; y <= bottom; y += 1) callback({ y, left, right });
    return;
  }

  const spans = new Map<number, { left: number; right: number }>();
  walkEllipseOutline({ x: left, y: top }, { x: right, y: bottom }, (point) => {
    const span = spans.get(point.y);
    if (span) {
      span.left = Math.min(span.left, point.x);
      span.right = Math.max(span.right, point.x);
    } else {
      spans.set(point.y, { left: point.x, right: point.x });
    }
  });

  [...spans.entries()]
    .sort(([firstY], [secondY]) => firstY - secondY)
    .forEach(([y, span]) => callback({ y, left: span.left, right: span.right }));
}

function dedupedEmitter(callback: (point: Point) => void): (x: number, y: number) => void {
  const emitted = new Set<string>();
  return (x, y) => {
    const key = `${x},${y}`;
    if (emitted.has(key)) return;
    emitted.add(key);
    callback({ x, y });
  };
}
