import { create } from "zustand";
import {
  cloneCommandSelectionSnapshot,
  createEditorCommand,
  editorCommandChangesDocument,
  editorCommandHasChanges,
  snapshotsEqual,
  type CommandSelectionSnapshot,
  type EditorCommand,
} from "../domain/commands";
import {
  addPixelLayer,
  clearActivePixelLayer,
  deleteActiveLayer,
  duplicateActiveLayer,
  hasLayerStackMutation,
  invertActivePixelLayer,
  moveActiveLayer,
  reorderLayer,
  setActiveLayerName,
  setLayerVisibility,
  setStackBackgroundColor,
  translateActiveLayerFrom,
} from "../domain/layerCommands";
import {
  activeLayer,
  activePixelLayer,
  activeStack,
  cloneLayer,
  cloneLayerStack,
  cloneObjectDefinition,
  cloneSnapshot,
  clampLayerIndex,
  createObjectDefinition,
  createObjectInstanceLayer,
  createRootStack,
  resizeSurface,
  isPixelEditableLayer,
  createDefaultPalette,
} from "../domain/layers";
import {
  canvasSelectionToLayerMask,
  cloneBinaryMaskSurface,
  cloneSelectionState,
  combineBinaryMaskSurface,
  createBinaryMaskSurface,
  createEllipseMask,
  createRectMask,
  createSelectionStateFromMask,
  liftSelectedPixels,
  maskIsEmpty,
  pasteFloatingPixels,
  resizeBinaryMaskSurface,
  translateBinaryMaskSurface,
} from "../domain/masks";
import { paletteEntryLabel } from "../domain/palette";
import { BLACK_PIXEL } from "../domain/types";
import type {
  BinaryMaskSurface,
  CanvasToolPreview,
  EditTarget,
  EditContext,
  EditorSnapshot,
  FloatingSelection,
  Layer,
  LayerStack,
  ObjectDefinition,
  PaletteIndex,
  PixelValue,
  PixelLayer,
  SelectionCombineMode,
  SelectionPreview,
  SelectionState,
  Tool,
} from "../domain/types";
import { openProjectFileWithDesktopDialog, saveBlobWithDesktopDialog } from "../desktop/desktopApi";
import { canvasToBlob, createProjectBundle, createPlaydatePngCanvas, type PreviewMode } from "../export/playdateExport";
import {
  deleteProjectDocument,
  listProjectSummaries,
  loadProjectDocument,
  saveProjectDocument,
} from "../persistence/projectDb";
import {
  deserializeProject,
  exportProjectJson,
  parseProjectJson,
  serializeProject,
  type ProjectSummary,
} from "../persistence/projectSchema";

interface PendingCommand {
  label: string;
  before: EditorSnapshot;
  beforeSelection: CommandSelectionSnapshot;
}

interface PendingMove {
  before: EditorSnapshot;
  context: EditContext;
  dx: number;
  dy: number;
  layer: Layer;
  layerIndex: number;
}

interface PendingSelectionMove {
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

export interface EditorSessionState {
  activeTool: Tool;
  activePaletteIndex: PaletteIndex;
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
  gridVisible: boolean;
  gridSize: number;
  colorizedPatternsVisible: boolean;
  zoom: number;
  status: string;
  cursorLabel: string;
  previewOpen: boolean;
  previewMode: PreviewMode;
  canvasToolPreview: CanvasToolPreview | null;
  selectionPreview: SelectionPreview | null;
  activeSelectionCombineMode: SelectionCombineMode | null;
  editTarget: EditTarget;
  rootSelection: SelectionState | null;
  objectSelection: SelectionState | null;
}

interface EditorStoreState extends EditorDocument, EditorSessionState {
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
  setActivePaletteIndex: (index: PaletteIndex) => void;
  setBrushSize: (size: number) => void;
  setMirrorX: (enabled: boolean) => void;
  setMirrorY: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setGridSize: (size: number) => void;
  setColorizedPatternsVisible: (visible: boolean) => void;
  setZoom: (zoom: number) => void;
  setStatus: (status: string) => void;
  setCursorLabel: (label: string) => void;
  setCanvasToolPreview: (preview: CanvasToolPreview | null) => void;
  setSelectionPreview: (preview: SelectionPreview | null) => void;
  setActiveSelectionCombineMode: (mode: SelectionCombineMode | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setEditTarget: (target: EditTarget) => void;
  setSelectionFromRect: (start: { x: number; y: number }, end: { x: number; y: number }, mode?: SelectionCombineMode) => void;
  setSelectionFromEllipse: (
    start: { x: number; y: number },
    end: { x: number; y: number },
    mode?: SelectionCombineMode,
  ) => void;
  clearSelection: () => void;
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
  newProject: () => void;
  renameProject: (name: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  loadMostRecentProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  exportProjectFile: () => Promise<void>;
  openProjectFile: () => Promise<void>;
  importProjectFile: (file: File) => Promise<void>;
  exportPng: () => Promise<void>;
  exportBundle: () => Promise<void>;
}

const initialSnapshot = createInitialSnapshot();

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  ...initialSnapshot,
  activeTool: "pencil",
  activePaletteIndex: BLACK_PIXEL,
  brushSize: 1,
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
  selectionPreview: null,
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

  setTool: (tool) =>
    set((state) => {
      const layer = activeLayer(state);
      const toolAllowed =
        tool === "marquee" ||
        tool === "ellipseSelect" ||
        (tool === "move" && Boolean(layer)) ||
        (state.editTarget === "alphaMask" && Boolean(layer)) ||
        isPixelEditableLayer(layer);

      if (!toolAllowed) {
        return { status: "Active layer does not support pixel drawing" };
      }

      return {
        activeTool: tool,
        status: `${TOOL_LABELS[tool]} ready`,
      };
    }),
  setActivePaletteIndex: (activePaletteIndex) =>
    set((state) => ({
      activePaletteIndex,
      status: `${paletteEntryLabel(state.palette, activePaletteIndex)} selected`,
    })),
  setBrushSize: (brushSize) => set({ brushSize }),
  setMirrorX: (mirrorX) => set({ mirrorX }),
  setMirrorY: (mirrorY) => set({ mirrorY }),
  setGridVisible: (gridVisible) =>
    set((state) => (state.gridVisible === gridVisible ? {} : { gridVisible, viewRevision: state.viewRevision + 1 })),
  setGridSize: (gridSize) =>
    set((state) => (state.gridSize === gridSize ? {} : { gridSize, viewRevision: state.viewRevision + 1 })),
  setColorizedPatternsVisible: (colorizedPatternsVisible) =>
    set((state) =>
      state.colorizedPatternsVisible === colorizedPatternsVisible
        ? {}
        : { colorizedPatternsVisible, viewRevision: state.viewRevision + 1 },
    ),
  setZoom: (zoom) => set({ zoom }),
  setStatus: (status) => set({ status }),
  setCursorLabel: (cursorLabel) => set({ cursorLabel }),
  setPreviewMode: (previewMode) =>
    set((state) => (state.previewMode === previewMode ? {} : { previewMode, viewRevision: state.viewRevision + 1 })),
  setCanvasToolPreview: (canvasToolPreview) =>
    set((state) => ({ canvasToolPreview, viewRevision: state.viewRevision + 1 })),
  setSelectionPreview: (selectionPreview) => set({ selectionPreview }),
  setActiveSelectionCombineMode: (activeSelectionCombineMode) => set({ activeSelectionCombineMode }),
  setEditTarget: (editTarget) =>
    set((state) =>
      state.editTarget === editTarget
        ? {}
        : {
            editTarget,
            activeTool: editTarget === "alphaMask" && state.activeTool === "move" ? "pencil" : state.activeTool,
            status: editTarget === "alphaMask" ? "Editing alpha mask" : "Editing pixels",
            viewRevision: state.viewRevision + 1,
          },
    ),
  setSelectionFromRect: (start, end, mode = "replace") => {
    setSelectionFromMask(set, selectionCommandLabel(mode, "selection"), selectionStatus(mode), mode, (width, height) =>
      createRectMask(width, height, start, end),
    );
  },
  setSelectionFromEllipse: (start, end, mode = "replace") => {
    setSelectionFromMask(set, selectionCommandLabel(mode, "ellipse selection"), selectionStatus(mode), mode, (width, height) =>
      createEllipseMask(width, height, start, end),
    );
  },
  clearSelection: () => {
    const before = currentSnapshot();
    const beforeSelection = currentSelectionSnapshot();
    set((state) => (activeSelection(state) ? setActiveSelectionState(state, null, "Selection cleared") : {}));
    pushCommand(
      set,
      createEditorCommand("Clear selection", before, currentSnapshot(), {
        afterSelection: currentSelectionSnapshot(),
        beforeSelection,
      }),
    );
  },
  addActiveLayerAlphaMask: () => {
    const before = currentSnapshot();
    let label = "Add alpha mask";
    set((current) => {
      const stack = activeStack(current);
      const layer = stack.layers[stack.activeLayerIndex];
      if (!layer) return { status: "Select a layer first" };
      if (layer.alphaMask) return { status: "Layer already has an alpha mask" };
      const size = layerAlphaMaskSize(layer, current.objects);
      if (!size) return { status: "Layer cannot be masked" };

      const selection = activeSelection(current);
      const hasSelection = Boolean(selection && !maskIsEmpty(selection.mask));
      const offset = layer.type === "object" ? { x: layer.x, y: layer.y } : { x: 0, y: 0 };
      const alphaMask =
        selection && hasSelection
          ? canvasSelectionToLayerMask(selection.mask, size.width, size.height, offset)
          : createBinaryMaskSurface(size.width, size.height, true);
      label = hasSelection ? "Selection to alpha mask" : "Add alpha mask";

      return {
        ...replaceActiveStack(current, {
          ...stack,
          layers: stack.layers.map((candidate, index) =>
            index === stack.activeLayerIndex ? { ...candidate, alphaMask } : candidate,
          ),
        }),
        status: hasSelection ? "Selection applied to alpha mask" : "Alpha mask added",
        documentRevision: current.documentRevision + 1,
        viewRevision: current.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, label, before);
  },
  removeActiveLayerAlphaMask: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const layer = stack.layers[stack.activeLayerIndex];
      if (!layer?.alphaMask) return { status: "Layer has no alpha mask" };
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((candidate, index) =>
            index === stack.activeLayerIndex ? { ...candidate, alphaMask: undefined } : candidate,
          ),
        }),
        status: "Alpha mask removed",
        editTarget: state.editTarget === "alphaMask" ? "pixels" : state.editTarget,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Remove alpha mask", before);
  },
  markViewChanged: () => set((state) => ({ viewRevision: state.viewRevision + 1 })),

  markDocumentChanged: (status) =>
    set((state) => ({
      ...bumpActiveLayerContent(state),
      status: status ?? state.status,
      documentRevision: state.documentRevision + 1,
      viewRevision: state.viewRevision + 1,
      hasUnsavedChanges: true,
    })),

  beginCommand: (label) => {
    const before = currentSnapshot();
    set({ pendingCommand: { label, before, beforeSelection: currentSelectionSnapshot() } });
  },

  commitCommand: (label) => {
    const state = get();
    const pending = state.pendingCommand;
    if (!pending) return;
    const after = currentSnapshot();
    if (snapshotsEqual(pending.before, after)) {
      set({ pendingCommand: null });
      return;
    }
    pushCommand(
      set,
      createEditorCommand(label ?? pending.label, pending.before, after, {
        beforeSelection: pending.beforeSelection,
        afterSelection: currentSelectionSnapshot(),
      }),
    );
  },

  discardPendingCommand: () => set({ pendingCommand: null }),

  beginMoveLayer: () => {
    const state = get();
    const stack = activeStack(state);
    const layer = stack.layers[stack.activeLayerIndex];
    if (!layer) {
      set({ status: "Select a layer to move" });
      return false;
    }

    const selection = activeSelection(state);
    if (state.editTarget === "pixels" && layer.type === "pixel") {
      const before = currentSnapshot();
      const originalLayer = cloneLayer(layer) as PixelLayer;
      const implicitFullLayer = !selection || maskIsEmpty(selection.mask);
      const moveSelection = implicitFullLayer
        ? createSelectionStateFromMask(createBinaryMaskSurface(layer.surface.width, layer.surface.height, true))
        : selection;
      const lifted = liftSelectedPixels(originalLayer, moveSelection.mask);
      set({
        pendingCommand: {
          label: implicitFullLayer ? "Move layer" : "Move selected pixels",
          before,
          beforeSelection: currentSelectionSnapshot(),
        },
        pendingSelectionMove: {
          before,
          context: state.activeContext,
          dx: 0,
          dy: 0,
          floating: {
            layerIndex: stack.activeLayerIndex,
            mask: cloneBinaryMaskSurface(moveSelection.mask),
            surface: lifted.floating,
          },
          implicitFullLayer,
          selection: createSelectionStateFromMask(cloneBinaryMaskSurface(moveSelection.mask)),
          sourceLayer: lifted.source,
        },
        pendingMove: null,
        status: implicitFullLayer ? "Moving layer" : "Moving selected pixels",
      });
      return true;
    }

    const before = currentSnapshot();
    set({
      pendingCommand: { label: "Move layer", before, beforeSelection: currentSelectionSnapshot() },
      pendingMove: {
        before,
        context: state.activeContext,
        dx: 0,
        dy: 0,
        layer: cloneLayer(layer),
        layerIndex: stack.activeLayerIndex,
      },
      status: "Moving layer",
    });
    return true;
  },

  previewSelectionMove: (dx, dy) =>
    set((state) => {
      const pendingSelectionMove = state.pendingSelectionMove;
      if (!pendingSelectionMove || (pendingSelectionMove.dx === dx && pendingSelectionMove.dy === dy)) return {};
      return {
        pendingSelectionMove: {
          ...pendingSelectionMove,
          dx,
          dy,
        },
      };
    }),

  commitMoveLayer: (dx, dy) => {
    const pendingSelectionMove = get().pendingSelectionMove;
    if (pendingSelectionMove) {
      const current = get();
      if (!editContextsEqual(current.activeContext, pendingSelectionMove.context)) {
        set({
          pendingCommand: null,
          pendingSelectionMove: null,
          status: "Move cancelled",
        });
        return false;
      }

      if (dx !== 0 || dy !== 0) {
        set((state) => {
          const stack = activeStack(state);
          let movedLayer = pasteFloatingPixels(pendingSelectionMove.sourceLayer, pendingSelectionMove.floating.surface, dx, dy);
          if (pendingSelectionMove.implicitFullLayer && pendingSelectionMove.sourceLayer.alphaMask) {
            movedLayer = {
              ...movedLayer,
              alphaMask: translateBinaryMaskSurface(pendingSelectionMove.sourceLayer.alphaMask, dx, dy),
            };
          }
          const movedSelection = createSelectionStateFromMask(
            translateBinaryMaskSurface(pendingSelectionMove.selection.mask, dx, dy),
          );
          return {
            ...replaceActiveStack(state, {
              ...stack,
              layers: stack.layers.map((layer, index) =>
                index === pendingSelectionMove.floating.layerIndex ? movedLayer : layer,
              ),
            }),
            ...(pendingSelectionMove.implicitFullLayer ? {} : setActiveSelectionStateFields(state, movedSelection)),
            status: pendingSelectionMove.implicitFullLayer ? `Layer moved ${dx}, ${dy}` : `Selected pixels moved ${dx}, ${dy}`,
          };
        });
      }

      const changed = !snapshotsEqual(pendingSelectionMove.before, currentSnapshot());
      set({ pendingSelectionMove: null });
      if (changed) {
        get().markDocumentChanged(pendingSelectionMove.implicitFullLayer ? "Layer moved" : "Selected pixels moved");
      }
      get().commitCommand(pendingSelectionMove.implicitFullLayer ? "Move layer" : "Move selected pixels");
      return changed;
    }

    const pending = get().pendingMove;
    if (!pending) return false;
    const current = get();
    if (!editContextsEqual(current.activeContext, pending.context)) {
      set({
        pendingCommand: null,
        pendingMove: null,
        status: "Move cancelled",
      });
      return false;
    }

    if (dx !== 0 || dy !== 0) {
      set((state) => {
        const stack = activeStack(state);
        const result = translateActiveLayerFrom(stack, pending.layer, pending.layerIndex, dx, dy);
        if (!hasLayerStackMutation(result)) return { status: result.status ?? state.status };

        return {
          ...replaceActiveStack(state, result.stack),
          pendingMove: { ...pending, dx, dy },
          status: `${result.status} ${dx}, ${dy}`,
        };
      });
    }

    const changed = !snapshotsEqual(pending.before, currentSnapshot());
    set({ pendingMove: null });
    if (changed) {
      get().markDocumentChanged("Layer moved");
    }
    get().commitCommand("Move layer");
    return changed;
  },

  cancelMoveLayer: () => {
    if (get().pendingSelectionMove) {
      set({
        pendingCommand: null,
        pendingSelectionMove: null,
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        status: "Move cancelled",
      });
      return;
    }
    const pending = get().pendingMove;
    if (!pending) return;
    set({
      ...snapshotState(pending.before),
      pendingCommand: null,
      pendingMove: null,
      canvasToolPreview: null,
      selectionPreview: null,
      activeSelectionCombineMode: null,
      status: "Move cancelled",
    });
  },

  undo: () =>
    set((state) => {
      const command = state.undoStack.at(-1);
      if (!command) return {};
      const undoStack = state.undoStack.slice(0, -1);
      const redoStack = [...state.redoStack, command];
      const changesDocument = editorCommandChangesDocument(command);
      return {
        ...snapshotState(command.before),
        ...commandSelectionState(command.beforeSelection),
        undoStack,
        redoStack,
        canUndo: undoStack.length > 0,
        canRedo: true,
        pendingCommand: null,
        pendingMove: null,
        pendingSelectionMove: null,
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        status: `Undo ${command.label}`,
        documentRevision: changesDocument ? state.documentRevision + 1 : state.documentRevision,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: changesDocument ? true : state.hasUnsavedChanges,
      };
    }),

  redo: () =>
    set((state) => {
      const command = state.redoStack.at(-1);
      if (!command) return {};
      const redoStack = state.redoStack.slice(0, -1);
      const undoStack = [...state.undoStack, command];
      const changesDocument = editorCommandChangesDocument(command);
      return {
        ...snapshotState(command.after),
        ...commandSelectionState(command.afterSelection),
        undoStack,
        redoStack,
        canUndo: true,
        canRedo: redoStack.length > 0,
        pendingCommand: null,
        pendingMove: null,
        pendingSelectionMove: null,
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        status: `Redo ${command.label}`,
        documentRevision: changesDocument ? state.documentRevision + 1 : state.documentRevision,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: changesDocument ? true : state.hasUnsavedChanges,
      };
    }),

  switchToRoot: () =>
    set((state) => {
      if (state.activeContext.type === "root") {
        return {
          canvasToolPreview: null,
          selectionPreview: null,
          activeSelectionCombineMode: null,
          pendingMove: null,
          pendingSelectionMove: null,
          cursorLabel: "x: -- y: --",
          objectSelection: null,
        };
      }

      return {
        activeContext: { type: "root" },
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        pendingMove: null,
        pendingSelectionMove: null,
        cursorLabel: "x: -- y: --",
        objectSelection: null,
        status: "Editing root canvas",
        viewRevision: state.viewRevision + 1,
      };
    }),

  switchToObject: (objectId) =>
    set((state) => {
      const object = state.objects.find((candidate) => candidate.id === objectId);
      if (!object) return { status: "Object was not found" };
      return {
        activeContext: { type: "object", objectId },
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        pendingMove: null,
        pendingSelectionMove: null,
        objectSelection: null,
        cursorLabel: "x: -- y: --",
        status: `Editing ${object.name}`,
        viewRevision:
          state.activeContext.type === "object" && state.activeContext.objectId === objectId
            ? state.viewRevision
            : state.viewRevision + 1,
      };
    }),

  addObject: () => {
    const before = currentSnapshot();
    const object = createObjectDefinition(crypto.randomUUID(), `Object ${get().objects.length + 1}`, 32, 32);
    set((state) => ({
      objects: [...state.objects, object],
      activeContext: { type: "object", objectId: object.id },
      canvasToolPreview: null,
      selectionPreview: null,
      activeSelectionCombineMode: null,
      editTarget: "pixels",
      objectSelection: null,
      status: `Created ${object.name}`,
      documentRevision: state.documentRevision + 1,
      viewRevision: state.viewRevision + 1,
      hasUnsavedChanges: true,
    }));
    pushCurrentCommand(set, `Create ${object.name}`, before);
  },

  renameObject: (objectId, name) => {
    const before = currentSnapshot();
    set((state) => ({
      objects: state.objects.map((object) => (object.id === objectId ? { ...object, name } : object)),
      root: {
        ...state.root,
        layers: state.root.layers.map((layer) =>
          layer.type === "object" && layer.objectId === objectId ? { ...layer, name } : layer,
        ),
      },
      status: "Object renamed",
      documentRevision: state.documentRevision + 1,
      viewRevision: state.viewRevision + 1,
      hasUnsavedChanges: true,
    }));
    pushCurrentCommand(set, "Rename object", before);
  },

  resizeObject: (objectId, width, height) => {
    const nextWidth = clampObjectDimension(width);
    const nextHeight = clampObjectDimension(height);
    const currentObject = get().objects.find((object) => object.id === objectId);
    if (!currentObject || (currentObject.width === nextWidth && currentObject.height === nextHeight)) return;
    const before = currentSnapshot();
    set((state) => ({
      objects: state.objects.map((object) =>
        object.id === objectId
          ? {
              ...object,
              width: nextWidth,
              height: nextHeight,
              layers: object.layers.map((layer) => ({
                ...layer,
                contentRevision: layer.contentRevision + 1,
                alphaMask: layer.alphaMask ? resizeBinaryMaskSurface(layer.alphaMask, nextWidth, nextHeight) : undefined,
                surface: resizeSurface(layer.surface, nextWidth, nextHeight),
              })),
            }
          : object,
      ),
      status: "Object resized",
      documentRevision: state.documentRevision + 1,
      viewRevision: state.viewRevision + 1,
      hasUnsavedChanges: true,
    }));
    pushCurrentCommand(set, "Resize object", before);
  },

  placeObjectOnRoot: (objectId, point) => {
    const object = get().objects.find((candidate) => candidate.id === objectId);
    if (!object) {
      set({ status: "Object was not found" });
      return;
    }
    const before = currentSnapshot();
    set((state) => {
      const layer = createObjectInstanceLayer(state.root.nextLayerId, object.name, objectId);
      layer.x = point?.x ?? Math.floor((state.root.width - object.width) / 2);
      layer.y = point?.y ?? Math.floor((state.root.height - object.height) / 2);
      const layers = [...state.root.layers];
      layers.splice(state.root.activeLayerIndex + 1, 0, layer);
      return {
        root: {
          ...state.root,
          nextLayerId: state.root.nextLayerId + 1,
          layers,
          activeLayerIndex: state.root.activeLayerIndex + 1,
        },
        activeContext: { type: "root" },
        status: `${object.name} instance added`,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, `Place ${object.name}`, before);
  },

  addLayer: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = addPixelLayer(stack);
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Add layer", before);
  },

  duplicateLayer: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = duplicateActiveLayer(stack);
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Duplicate layer", before);
  },

  deleteLayer: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = deleteActiveLayer(stack);
      if (!hasLayerStackMutation(result)) return {};
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Delete layer", before);
  },

  moveLayer: (direction) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = moveActiveLayer(stack, direction);
      if (!hasLayerStackMutation(result)) return {};
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, direction > 0 ? "Move layer up" : "Move layer down", before);
  },

  reorderLayer: (fromIndex, toIndex) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = reorderLayer(stack, fromIndex, toIndex);
      if (!hasLayerStackMutation(result)) return {};
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Reorder layer", before);
  },

  setActiveLayer: (activeLayerIndex) =>
    set((state) => {
      const stack = activeStack(state);
      const nextActiveLayerIndex = clampLayerIndex(activeLayerIndex, stack.layers.length);
      const layer = stack.layers[nextActiveLayerIndex];
      return {
        ...replaceActiveStack(state, { ...stack, activeLayerIndex: nextActiveLayerIndex }),
        status: layer?.type === "object" ? "Object instances are linked; edit the source object." : state.status,
      };
    }),

  renameLayer: (index, name) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = setActiveLayerName(stack, index, name);
      return {
        ...replaceActiveStack(state, result.stack),
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Rename layer", before);
  },

  setLayerVisible: (index, visible) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = setLayerVisibility(stack, index, visible);
      return {
        ...replaceActiveStack(state, result.stack),
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, visible ? "Show layer" : "Hide layer", before);
  },

  setStackBackground: (background) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = setStackBackgroundColor(stack, background);
      if (!hasLayerStackMutation(result)) return {};
      return {
        ...replaceActiveStack(state, result.stack),
        status: `Background ${paletteEntryLabel(state.palette, background)}`,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Set background", before);
  },

  clearActiveLayer: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = clearActivePixelLayer(stack);
      if (!hasLayerStackMutation(result)) return { status: result.status };
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Clear layer", before);
  },

  invertActiveLayer: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const result = invertActivePixelLayer(stack);
      if (!hasLayerStackMutation(result)) return { status: result.status };
      return {
        ...replaceActiveStack(state, result.stack),
        status: result.status,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, "Invert layer", before);
  },

  openPreview: () => set({ previewOpen: true }),
  closePreview: () => set({ previewOpen: false }),

  newProject: () => {
    const snapshot = createInitialSnapshot();
    set((state) => ({
      ...snapshot,
      projectName: "Untitled Playdate Art",
      currentProjectId: null,
      savedDocumentRevision: state.documentRevision + 1,
      pendingCommand: null,
      pendingMove: null,
      pendingSelectionMove: null,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      canvasToolPreview: null,
      selectionPreview: null,
      activeSelectionCombineMode: null,
      editTarget: "pixels",
      rootSelection: null,
      objectSelection: null,
      status: "New project",
      activePaletteIndex: BLACK_PIXEL,
      documentRevision: state.documentRevision + 1,
      viewRevision: state.viewRevision + 1,
      hasUnsavedChanges: false,
    }));
  },

  renameProject: (projectName) =>
    set((state) =>
      state.projectName === projectName
        ? {}
        : {
            projectName,
            documentRevision: state.documentRevision + 1,
            viewRevision: state.viewRevision + 1,
            hasUnsavedChanges: true,
          },
    ),

  saveProject: async () => {
    try {
      const state = get();
      const id = state.currentProjectId ?? crypto.randomUUID();
      const documentRevisionBeingSaved = state.documentRevision;
      const document = serializeProject(currentSnapshot(), id, state.projectName);
      const summary = await saveProjectDocument(document);
      set((current) => {
        const savedDocumentRevision = Math.max(current.savedDocumentRevision, documentRevisionBeingSaved);
        const allCurrentChangesSaved = current.documentRevision <= savedDocumentRevision;
        return {
          currentProjectId: id,
          savedDocumentRevision,
          hasUnsavedChanges: allCurrentChangesSaved ? false : current.hasUnsavedChanges,
          status: allCurrentChangesSaved ? "Project saved locally" : current.status,
          recentProjects: mergeSummary(current.recentProjects, summary),
        };
      });
    } catch {
      set({ status: "Unable to save project locally" });
    }
  },

  loadProject: async (id) => {
    try {
      const document = await loadProjectDocument(id);
      if (!document) {
        set({ status: "Project was not found" });
        return;
      }
      const snapshot = deserializeProject(document);
      set((state) => ({
        ...snapshotState(snapshot),
        projectName: document.name,
        currentProjectId: document.id,
        savedDocumentRevision: state.documentRevision + 1,
        pendingCommand: null,
        pendingMove: null,
        pendingSelectionMove: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        editTarget: "pixels",
        rootSelection: null,
        objectSelection: null,
        status: "Project loaded",
        activePaletteIndex: BLACK_PIXEL,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: false,
      }));
    } catch {
      set({ status: "Unable to load project" });
    }
  },

  loadMostRecentProject: async () => {
    try {
      const recentProjects = await listProjectSummaries();
      const mostRecentProject = recentProjects[0];
      set({ recentProjects });

      if (!mostRecentProject) {
        set({ status: "New project" });
        return;
      }

      const document = await loadProjectDocument(mostRecentProject.id);
      if (!document) {
        set({ status: "Most recent project was not found" });
        return;
      }

      const snapshot = deserializeProject(document);
      set((state) => ({
        ...snapshotState(snapshot),
        projectName: document.name,
        currentProjectId: document.id,
        savedDocumentRevision: state.documentRevision + 1,
        pendingCommand: null,
        pendingMove: null,
        pendingSelectionMove: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        canvasToolPreview: null,
        selectionPreview: null,
        activeSelectionCombineMode: null,
        editTarget: "pixels",
        rootSelection: null,
        objectSelection: null,
        status: "Most recent project loaded",
        activePaletteIndex: BLACK_PIXEL,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: false,
        recentProjects,
      }));
    } catch {
      set({ recentProjects: [], status: "Unable to read local projects" });
    }
  },

  deleteProject: async (id) => {
    try {
      await deleteProjectDocument(id);
      set((state) => ({
        recentProjects: state.recentProjects.filter((project) => project.id !== id),
        status: "Project deleted",
      }));
    } catch {
      set({ status: "Unable to delete project" });
    }
  },

  refreshProjects: async () => {
    try {
      const recentProjects = await listProjectSummaries();
      set({ recentProjects });
    } catch {
      set({ recentProjects: [], status: "Unable to read local projects" });
    }
  },

  exportProjectFile: async () => {
    try {
      const state = get();
      const id = state.currentProjectId ?? crypto.randomUUID();
      const document = serializeProject(currentSnapshot(), id, state.projectName);
      const saved = await saveBlobWithDesktopDialog(
        new Blob([exportProjectJson(document)], { type: "application/json" }),
        `${slugify(document.name)}.playdate-pixel.json`,
      );
      if (saved) set({ status: "Project file exported" });
    } catch {
      set({ status: "Unable to export project file" });
    }
  },

  openProjectFile: async () => {
    try {
      const result = await openProjectFileWithDesktopDialog();
      if (result.canceled) return;
      if (!result.text) {
        set({ status: "Unable to read project file" });
        return;
      }
      await importProjectText(result.text);
    } catch {
      set({ status: "Unable to import project file" });
    }
  },

  importProjectFile: async (file) => {
    try {
      await importProjectText(await file.text());
    } catch {
      set({ status: "Unable to import project file" });
    }
  },

  exportPng: async () => {
    try {
      const state = get();
      const canvas = createPlaydatePngCanvas(
        state.root.layers,
        state.previewMode,
        state.objects,
        state.root.background,
        state.palette,
      );
      const saved = await saveBlobWithDesktopDialog(await canvasToBlob(canvas), `${slugify(state.projectName)}.png`);
      if (saved) set({ status: "PNG exported" });
    } catch {
      set({ status: "Unable to export PNG" });
    }
  },

  exportBundle: async () => {
    try {
      const state = get();
      const id = state.currentProjectId ?? crypto.randomUUID();
      const document = serializeProject(currentSnapshot(), id, state.projectName);
      const bundle = await createProjectBundle(
        document,
        state.root.layers,
        state.objects,
        state.root.background,
        state.palette,
      );
      const saved = await saveBlobWithDesktopDialog(bundle, `${slugify(document.name)}.playdate-pixel.zip`);
      if (saved) set({ status: "Project bundle exported" });
    } catch {
      set({ status: "Unable to export project bundle" });
    }
  },
}));

async function importProjectText(text: string): Promise<void> {
  const document = parseProjectJson(text);
  const snapshot = deserializeProject(document);
  const normalizedDocument = serializeProject(snapshot, document.id, document.name);
  const saved = await saveProjectDocument(normalizedDocument);
  useEditorStore.setState((state) => ({
    ...snapshotState(snapshot),
    projectName: document.name,
    currentProjectId: document.id,
    savedDocumentRevision: state.documentRevision + 1,
    pendingCommand: null,
    pendingMove: null,
    pendingSelectionMove: null,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    canvasToolPreview: null,
    selectionPreview: null,
    activeSelectionCombineMode: null,
    editTarget: "pixels",
    rootSelection: null,
    objectSelection: null,
    status: "Project imported",
    activePaletteIndex: BLACK_PIXEL,
    documentRevision: state.documentRevision + 1,
    viewRevision: state.viewRevision + 1,
    hasUnsavedChanges: false,
    recentProjects: mergeSummary(state.recentProjects, saved),
  }));
}

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

export function selectActiveSelection(state: SelectionStateHost): SelectionState | null {
  return activeSelection(state);
}

export function hasActiveSelection(state: SelectionStateHost): boolean {
  return activeSelection(state)?.isEmpty === false;
}

function createInitialSnapshot(): EditorSnapshot {
  return {
    palette: createDefaultPalette(),
    root: createRootStack(),
    objects: [],
    activeContext: { type: "root" },
  };
}

function pushCurrentCommand(set: typeof useEditorStore.setState, label: string, before: EditorSnapshot): void {
  const after = currentSnapshot();
  if (snapshotsEqual(before, after)) return;
  const selection = currentSelectionSnapshot();
  pushCommand(
    set,
    createEditorCommand(label, before, after, {
      beforeSelection: selection,
      afterSelection: selection,
    }),
  );
}

function pushCommand(set: typeof useEditorStore.setState, command: EditorCommand): void {
  if (!editorCommandHasChanges(command)) return;
  set((state) => {
    const undoStack = [...state.undoStack, command].slice(-80);
    const changesDocument = editorCommandChangesDocument(command);
    return {
      undoStack,
      redoStack: [],
      pendingCommand: null,
      pendingMove: null,
      pendingSelectionMove: null,
      canUndo: undoStack.length > 0,
      canRedo: false,
      hasUnsavedChanges: changesDocument ? true : state.hasUnsavedChanges,
      status: command.label,
    };
  });
}

function setSelectionFromMask(
  set: typeof useEditorStore.setState,
  label: string,
  status: string,
  mode: SelectionCombineMode,
  createMask: (width: number, height: number) => BinaryMaskSurface,
): void {
  const before = currentSnapshot();
  const beforeSelection = currentSelectionSnapshot();
  set((state) => {
    const stack = activeStack(state);
    const combinedMask = combineBinaryMaskSurface(activeSelection(state)?.mask, createMask(stack.width, stack.height), mode);
    const selection = createSelectionStateFromMask(combinedMask);
    return setActiveSelectionState(state, selection.isEmpty ? null : selection, status);
  });
  pushCommand(
    set,
    createEditorCommand(label, before, currentSnapshot(), {
      afterSelection: currentSelectionSnapshot(),
      beforeSelection,
    }),
  );
}

function selectionCommandLabel(mode: SelectionCombineMode, shape: string): string {
  if (mode === "add") return `Add ${shape}`;
  if (mode === "subtract") return `Subtract ${shape}`;
  return shape === "ellipse selection" ? "Set ellipse selection" : "Set selection";
}

function selectionStatus(mode: SelectionCombineMode): string {
  if (mode === "add") return "Selection added";
  if (mode === "subtract") return "Selection subtracted";
  return "Selection created";
}

type SelectionStateHost = {
  activeContext: EditContext;
  objectSelection: SelectionState | null;
  rootSelection: SelectionState | null;
};

function activeSelection(state: SelectionStateHost): SelectionState | null {
  return state.activeContext.type === "root" ? state.rootSelection : state.objectSelection;
}

function setActiveSelectionState(
  state: Pick<EditorStoreState, "activeContext" | "viewRevision">,
  selection: SelectionState | null,
  status: string,
): Partial<EditorStoreState> {
  return {
    ...setActiveSelectionStateFields(state, selection),
    status,
    viewRevision: state.viewRevision + 1,
  };
}

function setActiveSelectionStateFields(
  state: Pick<EditorStoreState, "activeContext">,
  selection: SelectionState | null,
): Pick<EditorStoreState, "rootSelection"> | Pick<EditorStoreState, "objectSelection"> {
  return state.activeContext.type === "root" ? { rootSelection: selection } : { objectSelection: selection };
}

function currentSelectionSnapshot(): CommandSelectionSnapshot {
  return {
    objectSelection: cloneSelectionState(useEditorStore.getState().objectSelection),
    rootSelection: cloneSelectionState(useEditorStore.getState().rootSelection),
  };
}

function commandSelectionState(
  selection: CommandSelectionSnapshot | undefined,
): Pick<EditorStoreState, "objectSelection" | "rootSelection"> | Record<string, never> {
  if (!selection) return {};
  const cloned = cloneCommandSelectionSnapshot(selection);
  return {
    objectSelection: cloned.objectSelection,
    rootSelection: cloned.rootSelection,
  };
}

function layerAlphaMaskSize(layer: Layer, objects: ObjectDefinition[]): { width: number; height: number } | null {
  if (layer.type === "pixel") return { width: layer.surface.width, height: layer.surface.height };
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  return object ? { width: object.width, height: object.height } : null;
}

function snapshotFrom(
  snapshot: Pick<EditorSnapshot, "palette" | "root" | "objects" | "activeContext">,
): EditorSnapshot {
  return cloneSnapshot({
    palette: snapshot.palette,
    root: snapshot.root,
    objects: snapshot.objects,
    activeContext: snapshot.activeContext,
  });
}

function snapshotState(
  snapshot: EditorSnapshot,
): Pick<EditorStoreState, "palette" | "root" | "objects" | "activeContext"> {
  const cloned = cloneSnapshot(snapshot);
  return {
    palette: cloned.palette,
    root: cloned.root,
    objects: cloned.objects,
    activeContext: cloned.activeContext,
  };
}

function replaceActiveStack(
  state: Pick<EditorSnapshot, "root" | "objects" | "activeContext">,
  stack: LayerStack,
): Pick<EditorSnapshot, "root" | "objects"> {
  if (state.activeContext.type === "root") {
    return { root: cloneLayerStack(stack), objects: state.objects };
  }
  const context = state.activeContext;

  return {
    root: state.root,
    objects: state.objects.map((object) =>
      object.id === context.objectId
        ? { ...cloneObjectDefinition(object), ...stack, layers: stack.layers.filter(isPixelLayer) }
        : object,
    ),
  };
}

function editContextsEqual(left: EditContext, right: EditContext): boolean {
  if (left.type !== right.type) return false;
  return left.type === "root" || left.objectId === (right as { objectId: string }).objectId;
}

function bumpActiveLayerContent(state: EditorStoreState): Pick<EditorSnapshot, "root" | "objects"> {
  const stack = activeStack(state);
  return replaceActiveStack(state, {
    ...stack,
    layers: stack.layers.map((layer, index) =>
      index === stack.activeLayerIndex ? { ...layer, contentRevision: layer.contentRevision + 1 } : layer,
    ),
  });
}

function isPixelLayer(layer: Layer): layer is PixelLayer {
  return layer.type === "pixel";
}

function mergeSummary(summaries: ProjectSummary[], summary: ProjectSummary): ProjectSummary[] {
  return [summary, ...summaries.filter((project) => project.id !== summary.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "playdate-pixel-art"
  );
}

function clampObjectDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(400, Math.floor(value)));
}

export function contextLabel(context: EditContext, objects: ObjectDefinition[]): string {
  if (context.type === "root") return "Root Canvas";
  return objects.find((object) => object.id === context.objectId)?.name ?? "Missing Object";
}

const TOOL_LABELS: Record<Tool, string> = {
  move: "Move",
  marquee: "Marquee",
  ellipseSelect: "Ellipse Select",
  pencil: "Pencil",
  eraser: "Eraser",
  line: "Line",
  rect: "Rectangle",
  ellipse: "Ellipse",
  fill: "Fill",
};
