import type { LayerMovePreview, SelectionMovePreview } from "../rendering/frameComposer";
import type { SelectionOverlaySource } from "../rendering/selectionOverlaySource";
import type { Point, SelectionCombineMode, Tool } from "../domain/types";

export interface GestureTransaction {
  commit: (changed: boolean, status?: string) => void;
  discard: () => void;
  label: string;
  rollback: () => void;
}

export type EditorGestureState =
  | { type: "idle" }
  | {
      type: "selecting";
      combineMode: SelectionCombineMode;
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
      transaction: GestureTransaction;
    }
  | {
      type: "drawingAlphaMask";
      changed: boolean;
      lastPoint: Point;
      start: Point;
      tool: Tool;
      transaction: GestureTransaction;
    };

export interface EditorGestureEvent {
  altKey?: boolean;
  point: Point;
  shiftKey: boolean;
}

export function selectionCombineModeForModifiers({
  altKey,
  shiftKey,
}: Pick<EditorGestureEvent, "altKey" | "shiftKey">): SelectionCombineMode {
  if (altKey) return "subtract";
  if (shiftKey) return "add";
  return "replace";
}

export interface CanvasRenderRequest {
  layerMovePreview?: LayerMovePreview | null;
  selectionMovePreview?: SelectionMovePreview | null;
}

export interface GestureRenderBridge {
  requestCanvasRender: (request?: CanvasRenderRequest) => void;
  requestSelectionOverlayRender: (model: SelectionOverlaySource | null) => void;
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
