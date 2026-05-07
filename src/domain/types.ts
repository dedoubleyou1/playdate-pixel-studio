export type Tool = "pencil" | "eraser" | "line" | "rect" | "fill" | "dither";

export interface Point {
  x: number;
  y: number;
}

export interface PixelSurface {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface BaseLayer {
  id: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface PixelLayer extends BaseLayer {
  type: "pixel";
  surface: PixelSurface;
}

export interface ObjectInstanceLayer extends BaseLayer {
  type: "object";
  objectId: string;
  x: number;
  y: number;
}

export type Layer = PixelLayer | ObjectInstanceLayer;

export interface LayerStack {
  width: number;
  height: number;
  nextLayerId: number;
  activeLayerIndex: number;
  layers: Layer[];
}

export interface ObjectDefinition extends LayerStack {
  id: string;
  name: string;
  layers: PixelLayer[];
}

export type EditContext = { type: "root" } | { type: "object"; objectId: string };

export interface EditorSnapshot {
  root: LayerStack;
  objects: ObjectDefinition[];
  activeContext: EditContext;
}

export interface EditorState {
  root: LayerStack;
  objects: ObjectDefinition[];
  activeContext: EditContext;
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
