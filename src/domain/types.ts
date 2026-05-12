export type Tool =
  | "move"
  | "marquee"
  | "ellipseSelect"
  | "pencil"
  | "eraser"
  | "line"
  | "rect"
  | "ellipse"
  | "fill";
export const TRANSPARENT_PIXEL = 0;
export const BLACK_PIXEL = 1;
export const WHITE_PIXEL = 2;
export const MAX_PALETTE_INDEX = 63;
export type PaletteIndex = number;
export type PixelValue = PaletteIndex;
export type SolidPaletteValue = "alpha" | "black" | "white";

export interface BasePaletteEntry {
  id: string;
  index: PaletteIndex;
  name: string;
}

export interface SolidPaletteEntry extends BasePaletteEntry {
  type: "solid";
  value: SolidPaletteValue;
}

export interface DitherPaletteEntry extends BasePaletteEntry {
  type: "dither";
  patternId: string;
  foregroundIndex: PaletteIndex;
  backgroundIndex: PaletteIndex;
}

export type PaletteEntry = SolidPaletteEntry | DitherPaletteEntry;

export interface ProjectPalette {
  entries: PaletteEntry[];
}

export interface Point {
  x: number;
  y: number;
}

export interface PixelSurface {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface BinaryMaskSurface {
  width: number;
  height: number;
  data: Uint8Array;
}

export type LayerAlphaMask = BinaryMaskSurface;
export type EditTarget = "pixels" | "alphaMask";

export interface SelectionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SelectionState {
  bounds: SelectionBounds | null;
  isEmpty: boolean;
  mask: BinaryMaskSurface;
}

export type SelectionCombineMode = "replace" | "add" | "subtract";

export interface FloatingSelection {
  layerIndex: number;
  mask: BinaryMaskSurface;
  surface: PixelSurface;
}

export interface BaseLayer {
  id: number;
  name: string;
  visible: boolean;
  pixelEditable: boolean;
  contentRevision: number;
  alphaMask?: LayerAlphaMask;
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
  background: PixelValue;
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
  palette: ProjectPalette;
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

interface BaseToolPreview {
  start: Point;
  end: Point;
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
}

export interface CanvasToolPreview extends BaseToolPreview {
  type: "line" | "rect" | "ellipse";
}

export interface SelectionPreview extends BaseToolPreview {
  combineMode: SelectionCombineMode;
  type: "rect" | "ellipse";
}
