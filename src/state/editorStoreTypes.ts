import type { CommandSelectionSnapshot, EditorCommand } from "../domain/commands";
import type { ImageImportMapping, PreparedImageImport } from "../domain/imageImport";
import type {
  BrushShape,
  CanvasToolPreview,
  EditContext,
  EditorSnapshot,
  EditTarget,
  FloatingSelection,
  Layer,
  SwatchRef,
  PatternPaletteEntry,
  PatternSamplingSettings,
  PixelLayer,
  PixelValue,
  SelectionCombineMode,
  SelectionState,
  Tool,
} from "../domain/types";
import type { PreviewMode } from "../export/playdateExport";
import type { ProjectSummary } from "../persistence/projectSchema";

export interface PendingCommand {
  label: string;
  before: EditorSnapshot;
  beforeSelection: CommandSelectionSnapshot;
}

export interface PendingMove {
  before: EditorSnapshot;
  context: EditContext;
  dx: number;
  dy: number;
  layer: Layer;
  layerIndex: number;
}

export interface PendingSelectionMove {
  before: EditorSnapshot;
  context: EditContext;
  dx: number;
  dy: number;
  floating: FloatingSelection;
  implicitFullLayer: boolean;
  selection: SelectionState;
  sourceLayer: PixelLayer;
}

export type EditorDocument = EditorSnapshot;

export interface PendingImageImportFile {
  data: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

export interface CommitImageImportRequest {
  fileName: string;
  mapping: ImageImportMapping;
  prepared: PreparedImageImport;
}

export interface EditorSessionState {
  activeTool: Tool;
  activeSwatchRef: SwatchRef;
  brushSize: number;
  brushShape: BrushShape;
  mirrorX: boolean;
  mirrorY: boolean;
  gridVisible: boolean;
  gridSize: number;
  colorizedPatternsVisible: boolean;
  colorizedPatternsModifierActive: boolean;
  zoom: number;
  status: string;
  cursorLabel: string;
  previewOpen: boolean;
  previewMode: PreviewMode;
  canvasToolPreview: CanvasToolPreview | null;
  activeSelectionCombineMode: SelectionCombineMode | null;
  gestureActive: boolean;
  editTarget: EditTarget;
  rootSelection: SelectionState | null;
  objectSelection: SelectionState | null;
  pendingImageImportFile: PendingImageImportFile | null;
}

export interface EditorStoreState extends EditorDocument, EditorSessionState {
  documentRevision: number;
  savedDocumentRevision: number;
  viewRevision: number;
  currentProjectId: string | null;
  projectName: string;
  recentProjects: ProjectSummary[];
  pendingCommand: PendingCommand | null;
  pendingMove: PendingMove | null;
  pendingSelectionMove: PendingSelectionMove | null;
  undoStack: EditorCommand[];
  redoStack: EditorCommand[];
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  setTool: (tool: Tool) => void;
  setActiveSwatchRef: (ref: SwatchRef) => void;
  addPatternSwatch: (patternId: string, sampling?: PatternSamplingSettings) => void;
  updatePatternSwatch: (
    ref: SwatchRef,
    updates: Partial<
      Pick<PatternPaletteEntry, "offsetX" | "offsetY" | "patternId" | "reflectX" | "reflectY" | "rotation">
    >,
  ) => void;
  duplicatePatternSwatch: (ref: SwatchRef) => void;
  deletePatternSwatch: (ref: SwatchRef) => void;
  setBrushSize: (size: number) => void;
  setBrushShape: (shape: BrushShape) => void;
  setMirrorX: (enabled: boolean) => void;
  setMirrorY: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setGridSize: (size: number) => void;
  setColorizedPatternsVisible: (visible: boolean) => void;
  setColorizedPatternsModifierActive: (active: boolean) => void;
  setZoom: (zoom: number) => void;
  setStatus: (status: string) => void;
  setCursorLabel: (label: string) => void;
  setCanvasToolPreview: (preview: CanvasToolPreview | null) => void;
  setActiveSelectionCombineMode: (mode: SelectionCombineMode | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setEditTarget: (target: EditTarget) => void;
  setSelectionFromRect: (
    start: { x: number; y: number },
    end: { x: number; y: number },
    mode?: SelectionCombineMode,
  ) => void;
  setSelectionFromEllipse: (
    start: { x: number; y: number },
    end: { x: number; y: number },
    mode?: SelectionCombineMode,
  ) => void;
  clearSelection: () => void;
  copySelection: () => Promise<boolean>;
  cutSelection: () => Promise<boolean>;
  pasteClipboard: () => Promise<boolean>;
  addActiveLayerAlphaMask: () => void;
  removeActiveLayerAlphaMask: () => void;
  markViewChanged: () => void;
  markDocumentChanged: (status?: string) => void;
  beginCommand: (label: string) => void;
  commitCommand: (label?: string) => void;
  discardPendingCommand: () => void;
  beginMoveLayer: () => boolean;
  previewSelectionMove: (dx: number, dy: number) => void;
  commitMoveLayer: (dx: number, dy: number) => boolean;
  cancelMoveLayer: () => void;
  undo: () => void;
  redo: () => void;
  switchToRoot: () => void;
  switchToObject: (objectId: string) => void;
  addObject: () => void;
  duplicateObject: (objectId: string) => void;
  deleteObject: (objectId: string) => void;
  renameObject: (objectId: string, name: string) => void;
  resizeObject: (objectId: string, width: number, height: number) => void;
  placeObjectOnRoot: (objectId: string, point?: { x: number; y: number }) => void;
  addLayer: () => void;
  duplicateLayer: () => void;
  deleteLayer: () => void;
  moveLayer: (direction: -1 | 1) => void;
  reorderLayer: (fromIndex: number, toIndex: number) => void;
  setActiveLayer: (index: number) => void;
  renameLayer: (index: number, name: string) => void;
  setLayerVisible: (index: number, visible: boolean) => void;
  setStackBackground: (background: PixelValue) => void;
  clearActiveLayer: () => void;
  invertActiveLayer: () => void;
  openPreview: () => void;
  closePreview: () => void;
  clearPendingImageImportFile: () => void;
  newProject: () => void;
  renameProject: (name: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  loadMostRecentProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  exportProjectFile: () => Promise<void>;
  openImageImportFile: () => Promise<void>;
  importImageFile: (file: File) => Promise<void>;
  commitImageImport: (request: CommitImageImportRequest) => void;
  openProjectFile: () => Promise<void>;
  importProjectFile: (file: File) => Promise<void>;
  exportPng: () => Promise<void>;
  exportBundle: () => Promise<void>;
}

export type EditorStoreSet = (
  partial:
    | EditorStoreState
    | Partial<EditorStoreState>
    | ((state: EditorStoreState) => EditorStoreState | Partial<EditorStoreState>),
  replace?: false,
) => void;

export type EditorStoreGet = () => EditorStoreState;
