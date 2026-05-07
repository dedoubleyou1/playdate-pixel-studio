export type Tool = "pencil" | "eraser" | "line" | "rect" | "fill" | "dither";

export interface Point {
  x: number;
  y: number;
}

export interface PixelLayer {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  data: Uint8Array;
}

export interface EditorSnapshot {
  nextLayerId: number;
  activeLayerIndex: number;
  layers: PixelLayer[];
}

export interface EditorState extends EditorSnapshot {
  activeTool: Tool;
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
  status: string;
}

export interface ShapePreview {
  type: "line" | "rect";
  start: Point;
  end: Point;
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
}
