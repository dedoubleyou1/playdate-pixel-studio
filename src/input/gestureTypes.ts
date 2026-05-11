import type { LayerMovePreview } from "../rendering/frameComposer";
import type { Point, Tool } from "../domain/types";

export type EditorGestureState =
  | { type: "idle" }
  | {
      type: "selecting";
      start: Point;
      tool: Tool;
    }
  | {
      type: "movingLayer";
      lastDelta: Point;
      layerIndex: number;
      start: Point;
      tool: "move";
    }
  | {
      type: "movingPixels";
      lastDelta: Point;
      layerIndex: number;
      start: Point;
      tool: "move";
    }
  | {
      type: "drawingPixels";
      changed: boolean;
      lastPoint: Point;
      start: Point;
      tool: Tool;
    }
  | {
      type: "drawingAlphaMask";
      changed: boolean;
      lastPoint: Point;
      start: Point;
      tool: Tool;
    };

export interface EditorGestureEvent {
  point: Point;
  shiftKey: boolean;
}

export interface GestureRenderBridge {
  requestCanvasRender: (movePreview?: LayerMovePreview | null) => void;
}

export const idleGestureState: EditorGestureState = { type: "idle" };

export function isActiveGesture(state: EditorGestureState): boolean {
  return state.type !== "idle";
}

export function constrainedShapeEndPoint(start: Point | null, end: Point, tool: Tool, constrain: boolean): Point {
  if (!start || !constrain || (tool !== "rect" && tool !== "ellipse" && tool !== "ellipseSelect")) return end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx) * size,
    y: start.y + Math.sign(dy) * size,
  };
}

export function isSelectionTool(tool: Tool): boolean {
  return tool === "marquee" || tool === "ellipseSelect";
}

export function selectionPreviewType(tool: Tool): "ellipse" | "rect" {
  return tool === "ellipseSelect" ? "ellipse" : "rect";
}
