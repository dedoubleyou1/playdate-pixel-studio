import { indexFor, inBounds, mirroredPoints, walkEllipseOutline, walkLine, walkRectOutline } from "./pixelGeometry";
import type { BinaryMaskSurface, CanvasToolPreview, Point, Tool } from "./types";

export interface MaskToolSettings {
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
  value: 0 | 1;
}

export function maskCommandLabel(tool: Tool): string {
  if (tool === "eraser") return "Hide alpha mask";
  if (tool === "line") return "Draw alpha mask line";
  if (tool === "rect") return "Draw alpha mask rectangle";
  if (tool === "ellipse") return "Draw alpha mask ellipse";
  if (tool === "fill") return "Fill alpha mask";
  return "Paint alpha mask";
}

export function createMaskCanvasToolPreview(
  start: Point,
  end: Point,
  tool: Tool,
  settings: MaskToolSettings,
): CanvasToolPreview | null {
  if (tool !== "line" && tool !== "rect" && tool !== "ellipse") return null;
  return {
    type: tool === "rect" || tool === "ellipse" ? tool : "line",
    start,
    end,
    brushSize: settings.brushSize,
    mirrorX: settings.mirrorX,
    mirrorY: settings.mirrorY,
  };
}

export function applyMaskToolStart(
  mask: BinaryMaskSurface,
  point: Point,
  tool: Tool,
  settings: MaskToolSettings,
): boolean {
  if (tool === "pencil" || tool === "eraser") return drawMaskBrushAt(mask, point, settings);
  if (tool === "fill") return floodFillMask(mask, point, settings.value);
  return false;
}

export function applyMaskToolDrag(
  mask: BinaryMaskSurface,
  start: Point,
  end: Point,
  tool: Tool,
  settings: MaskToolSettings,
): boolean {
  if (tool !== "pencil" && tool !== "eraser") return false;
  let changed = false;
  walkLine(start, end, (point) => {
    changed = drawMaskBrushAt(mask, point, settings) || changed;
  });
  return changed;
}

export function applyMaskToolFinish(
  mask: BinaryMaskSurface,
  start: Point,
  end: Point,
  tool: Tool,
  settings: MaskToolSettings,
): boolean {
  if (tool === "line") {
    let changed = false;
    walkLine(start, end, (point) => {
      changed = drawMaskBrushAt(mask, point, settings) || changed;
    });
    return changed;
  }

  if (tool === "rect") {
    let changed = false;
    walkRectOutline(start, end, (point) => {
      changed = drawMaskBrushAt(mask, point, settings) || changed;
    });
    return changed;
  }

  if (tool === "ellipse") {
    let changed = false;
    walkEllipseOutline(start, end, (point) => {
      changed = drawMaskBrushAt(mask, point, settings) || changed;
    });
    return changed;
  }

  return false;
}

function drawMaskBrushAt(mask: BinaryMaskSurface, point: Point, settings: MaskToolSettings): boolean {
  const half = Math.floor(settings.brushSize / 2);
  let changed = false;

  for (const mirroredPoint of mirroredPoints(point.x, point.y, settings.mirrorX, settings.mirrorY, mask.width, mask.height)) {
    for (let yy = 0; yy < settings.brushSize; yy += 1) {
      for (let xx = 0; xx < settings.brushSize; xx += 1) {
        const x = mirroredPoint.x + xx - half;
        const y = mirroredPoint.y + yy - half;
        changed = setMaskValue(mask, x, y, settings.value) || changed;
      }
    }
  }

  return changed;
}

function floodFillMask(mask: BinaryMaskSurface, point: Point, value: 0 | 1): boolean {
  if (!inBounds(point.x, point.y, mask.width, mask.height)) return false;
  const startIndex = indexFor(point.x, point.y, mask.width);
  const target = mask.data[startIndex] ? 1 : 0;
  if (target === value) return false;

  const stack: Point[] = [point];
  const visited = new Uint8Array(mask.data.length);
  let changed = false;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !inBounds(current.x, current.y, mask.width, mask.height)) continue;
    const index = indexFor(current.x, current.y, mask.width);
    if (visited[index]) continue;
    visited[index] = 1;
    if ((mask.data[index] ? 1 : 0) !== target) continue;

    changed = setMaskValue(mask, current.x, current.y, value) || changed;
    stack.push(
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    );
  }

  return changed;
}

function setMaskValue(mask: BinaryMaskSurface, x: number, y: number, value: 0 | 1): boolean {
  if (!inBounds(x, y, mask.width, mask.height)) return false;
  const index = indexFor(x, y, mask.width);
  if (mask.data[index] === value) return false;
  mask.data[index] = value;
  return true;
}
