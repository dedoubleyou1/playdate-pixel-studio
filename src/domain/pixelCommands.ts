import {
  TRANSPARENT_PIXEL,
  type BinaryMaskSurface,
  type BrushShape,
  type CanvasToolPreview,
  type PaletteIndex,
  type PixelLayer,
  type Point,
  type Tool,
} from "./types";
import { drawBrushAt, drawEllipse, drawInterpolatedStroke, drawLine, drawRect, floodFill, type BrushOptions } from "./pixelOps";

export interface PixelToolSettings {
  brushSize: number;
  brushShape: BrushShape;
  mirrorX: boolean;
  mirrorY: boolean;
  paletteIndex: PaletteIndex;
  selectionMask?: BinaryMaskSurface | null;
}

export interface PixelOperationResult {
  changed: boolean;
}

export function pixelCommandLabel(tool: Tool): string {
  if (tool === "eraser") return "Erase stroke";
  if (tool === "line") return "Draw line";
  if (tool === "rect") return "Draw rectangle";
  if (tool === "ellipse") return "Draw ellipse";
  if (tool === "fill") return "Fill area";
  return "Draw stroke";
}

export function isBrushTool(tool: Tool): boolean {
  return tool === "pencil" || tool === "eraser";
}

export function isShapeTool(tool: Tool): boolean {
  return tool === "line" || tool === "rect" || tool === "ellipse";
}

export function isFillTool(tool: Tool): boolean {
  return tool === "fill";
}

export function createCanvasToolPreview(
  start: Point,
  end: Point,
  tool: Tool,
  settings: PixelToolSettings,
): CanvasToolPreview | null {
  if (!isShapeTool(tool)) return null;
  return {
    type: tool === "rect" || tool === "ellipse" ? tool : "line",
    start,
    end,
    brushSize: settings.brushSize,
    brushShape: settings.brushShape,
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
    return { changed: floodFill(layer, point, paletteIndexForTool(tool, settings), settings.selectionMask) };
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

  if (tool === "ellipse") {
    return { changed: drawEllipse(layer, start, end, brushOptions(tool, settings)) };
  }

  return { changed: false };
}

function brushOptions(tool: Tool, settings: PixelToolSettings): BrushOptions {
  return {
    shape: settings.brushShape,
    size: settings.brushSize,
    mirrorX: settings.mirrorX,
    mirrorY: settings.mirrorY,
    paletteIndex: paletteIndexForTool(tool, settings),
    selectionMask: settings.selectionMask,
  };
}

export function paletteIndexForTool(tool: Tool, settings: PixelToolSettings): PaletteIndex {
  if (tool === "eraser") return TRANSPARENT_PIXEL;
  return settings.paletteIndex;
}
