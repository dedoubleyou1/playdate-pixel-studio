import { TRANSPARENT_PIXEL, type PixelLayer, type PixelValue, type Point, type ShapePreview, type Tool } from "./types";
import { checkerDitherPaint, solidPaint, type PaintSource } from "./paintSources";
import { drawBrushAt, drawInterpolatedStroke, drawLine, drawRect, floodFill, type BrushOptions } from "./pixelOps";

export interface PixelToolSettings {
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
  paintValue: PixelValue;
}

export interface PixelOperationResult {
  changed: boolean;
}

export function pixelCommandLabel(tool: Tool): string {
  if (tool === "eraser") return "Erase stroke";
  if (tool === "line") return "Draw line";
  if (tool === "rect") return "Draw rectangle";
  if (tool === "fill") return "Fill area";
  return "Draw stroke";
}

export function isBrushTool(tool: Tool): boolean {
  return tool === "pencil" || tool === "eraser" || tool === "dither";
}

export function isShapeTool(tool: Tool): boolean {
  return tool === "line" || tool === "rect";
}

export function isFillTool(tool: Tool): boolean {
  return tool === "fill";
}

export function createShapePreview(
  start: Point,
  end: Point,
  tool: Tool,
  settings: PixelToolSettings,
): ShapePreview | null {
  if (!isShapeTool(tool)) return null;
  return {
    type: tool === "rect" ? "rect" : "line",
    start,
    end,
    brushSize: settings.brushSize,
    mirrorX: settings.mirrorX,
    mirrorY: settings.mirrorY,
  };
}

export function applyPixelToolStart(
  layer: PixelLayer,
  point: Point,
  tool: Tool,
  settings: PixelToolSettings,
): PixelOperationResult {
  if (isBrushTool(tool)) {
    return { changed: drawBrushAt(layer, point, brushOptions(tool, settings)) };
  }

  if (isFillTool(tool)) {
    return { changed: floodFill(layer, point, paintSourceForTool(tool, settings)) };
  }

  return { changed: false };
}

export function applyPixelToolDrag(
  layer: PixelLayer,
  start: Point,
  end: Point,
  tool: Tool,
  settings: PixelToolSettings,
): PixelOperationResult {
  if (!isBrushTool(tool)) return { changed: false };
  return { changed: drawInterpolatedStroke(layer, start, end, brushOptions(tool, settings)) };
}

export function applyPixelToolFinish(
  layer: PixelLayer,
  start: Point,
  end: Point,
  tool: Tool,
  settings: PixelToolSettings,
): PixelOperationResult {
  if (tool === "line") {
    return { changed: drawLine(layer, start, end, brushOptions(tool, settings)) };
  }

  if (tool === "rect") {
    return { changed: drawRect(layer, start, end, brushOptions(tool, settings)) };
  }

  return { changed: false };
}

function brushOptions(tool: Tool, settings: PixelToolSettings): BrushOptions {
  return {
    size: settings.brushSize,
    mirrorX: settings.mirrorX,
    mirrorY: settings.mirrorY,
    paintSource: paintSourceForTool(tool, settings),
  };
}

export function paintSourceForTool(tool: Tool, settings: PixelToolSettings): PaintSource {
  if (tool === "eraser") return solidPaint(TRANSPARENT_PIXEL);
  if (tool === "dither") {
    return checkerDitherPaint({
      foreground: settings.paintValue,
      background: TRANSPARENT_PIXEL,
    });
  }
  return solidPaint(settings.paintValue);
}
