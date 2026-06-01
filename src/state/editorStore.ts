import { create } from "zustand";
import { activeLayer, activePixelLayer, activeStack } from "../domain/layers";
import type { EditorSnapshot, Layer, LayerStack, PixelLayer, SelectionState } from "../domain/types";
import { BLACK_PIXEL } from "../domain/types";
import { createHistoryActions } from "./actions/historyActions";
import { createInteractionActions } from "./actions/interactionActions";
import { createLayerActions } from "./actions/layerActions";
import { createPaletteActions } from "./actions/paletteActions";
import { createObjectActions } from "./actions/objectActions";
import { createProjectActions } from "./actions/projectActions";
import { createSelectionActions } from "./actions/selectionActions";
import {
  activeSelection,
  contextLabel,
  createInitialSnapshot,
  hasActiveSelection,
  selectActiveSelection,
  snapshotFrom,
} from "./editorStoreHelpers";
import type { EditorDocument, EditorSessionState, EditorStoreState } from "./editorStoreTypes";

export type { EditorDocument, EditorSessionState, EditorStoreState };
export { contextLabel, hasActiveSelection, selectActiveSelection };

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  ...createInitialSnapshot(),
  activeTool: "pencil",
  activeSwatchRef: BLACK_PIXEL,
  brushSize: 1,
  brushShape: "square",
  mirrorX: false,
  mirrorY: false,
  gridVisible: false,
  gridSize: 1,
  colorizedPatternsVisible: false,
  zoom: 2,
  status: "Pencil ready",
  cursorLabel: "x: -- y: --",
  previewOpen: false,
  previewMode: "normal",
  canvasToolPreview: null,
  activeSelectionCombineMode: null,
  editTarget: "pixels",
  rootSelection: null,
  objectSelection: null,
  documentRevision: 0,
  savedDocumentRevision: 0,
  viewRevision: 0,
  currentProjectId: null,
  projectName: "Untitled Playdate Art",
  recentProjects: [],
  pendingCommand: null,
  pendingMove: null,
  pendingSelectionMove: null,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  hasUnsavedChanges: false,
  ...createInteractionActions(set),
  ...createPaletteActions(set, get),
  ...createSelectionActions(set, get),
  ...createHistoryActions(set, get),
  ...createObjectActions(set, get),
  ...createLayerActions(set, get),
  ...createProjectActions(set, get),
}));

export function currentSnapshot(): EditorSnapshot {
  return snapshotFrom(useEditorStore.getState());
}

export function currentActiveStack(): LayerStack {
  return activeStack(useEditorStore.getState());
}

export function currentActiveLayer(): Layer | undefined {
  return activeLayer(useEditorStore.getState());
}

export function currentActivePixelLayer(): PixelLayer | null {
  return activePixelLayer(useEditorStore.getState());
}

export function currentSelection(): SelectionState | null {
  return activeSelection(useEditorStore.getState());
}
