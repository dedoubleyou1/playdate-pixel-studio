import { create } from "zustand";
import { createDocumentCommand, snapshotsEqual, type DocumentCommand } from "../domain/commands";
import {
  activeLayer,
  activePixelLayer,
  activeStack,
  clampLayerIndex,
  cloneLayer,
  cloneLayerStack,
  cloneObjectDefinition,
  cloneSnapshot,
  createLayer,
  createObjectDefinition,
  createObjectInstanceLayer,
  createRootStack,
  isPixelEditableLayer,
  resizeSurface,
} from "../domain/layers";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  PixelValue,
  PixelLayer,
  ShapePreview,
  Tool,
} from "../domain/types";
import { createProjectBundle, createPlaydatePngCanvas, downloadBlob, type PreviewMode } from "../export/playdateExport";
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
}

export type EditorDocument = EditorSnapshot;

export interface EditorSessionState {
  activeTool: Tool;
  activePaintValue: PixelValue;
  brushSize: number;
  mirrorX: boolean;
  mirrorY: boolean;
  gridVisible: boolean;
  gridSize: number;
  zoom: number;
  status: string;
  cursorLabel: string;
  previewOpen: boolean;
  previewMode: PreviewMode;
  shapePreview: ShapePreview | null;
}

interface EditorStoreState extends EditorDocument, EditorSessionState {
  documentRevision: number;
  savedDocumentRevision: number;
  viewRevision: number;
  currentProjectId: string | null;
  projectName: string;
  recentProjects: ProjectSummary[];
  pendingCommand: PendingCommand | null;
  undoStack: DocumentCommand[];
  redoStack: DocumentCommand[];
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  setTool: (tool: Tool) => void;
  setPaintValue: (value: PixelValue) => void;
  setBrushSize: (size: number) => void;
  setMirrorX: (enabled: boolean) => void;
  setMirrorY: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setGridSize: (size: number) => void;
  setZoom: (zoom: number) => void;
  setStatus: (status: string) => void;
  setCursorLabel: (label: string) => void;
  setShapePreview: (preview: ShapePreview | null) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  markViewChanged: () => void;
  markDocumentChanged: (status?: string) => void;
  beginCommand: (label: string) => void;
  commitCommand: (label?: string) => void;
  discardPendingCommand: () => void;
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
  setActiveLayer: (index: number) => void;
  renameLayer: (index: number, name: string) => void;
  setLayerVisible: (index: number, visible: boolean) => void;
  setLayerOpacity: (opacity: number) => void;
  setStackBackground: (background: PixelValue) => void;
  commitLayerOpacity: () => void;
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
  exportProjectFile: () => void;
  importProjectFile: (file: File) => Promise<void>;
  exportPng: () => void;
  exportBundle: () => Promise<void>;
}

const initialSnapshot = createInitialSnapshot();

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  ...initialSnapshot,
  activeTool: "pencil",
  activePaintValue: BLACK_PIXEL,
  brushSize: 1,
  mirrorX: false,
  mirrorY: false,
  gridVisible: false,
  gridSize: 1,
  zoom: 2,
  status: "Pencil ready",
  cursorLabel: "x: -- y: --",
  previewOpen: false,
  previewMode: "normal",
  shapePreview: null,
  documentRevision: 0,
  savedDocumentRevision: 0,
  viewRevision: 0,
  currentProjectId: null,
  projectName: "Untitled Playdate Art",
  recentProjects: [],
  pendingCommand: null,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,
  hasUnsavedChanges: false,

  setTool: (tool) =>
    set((state) =>
      isPixelEditableLayer(activeLayer(state))
        ? { activeTool: tool, status: `${TOOL_LABELS[tool]} ready` }
        : { status: "Active layer does not support pixel drawing" },
    ),
  setPaintValue: (activePaintValue) =>
    set({ activePaintValue, status: `Paint ${PIXEL_VALUE_LABELS[activePaintValue]} selected` }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setMirrorX: (mirrorX) => set({ mirrorX }),
  setMirrorY: (mirrorY) => set({ mirrorY }),
  setGridVisible: (gridVisible) =>
    set((state) => (state.gridVisible === gridVisible ? {} : { gridVisible, viewRevision: state.viewRevision + 1 })),
  setGridSize: (gridSize) =>
    set((state) => (state.gridSize === gridSize ? {} : { gridSize, viewRevision: state.viewRevision + 1 })),
  setZoom: (zoom) => set({ zoom }),
  setStatus: (status) => set({ status }),
  setCursorLabel: (cursorLabel) => set({ cursorLabel }),
  setPreviewMode: (previewMode) =>
    set((state) => (state.previewMode === previewMode ? {} : { previewMode, viewRevision: state.viewRevision + 1 })),
  setShapePreview: (shapePreview) => set((state) => ({ shapePreview, viewRevision: state.viewRevision + 1 })),

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
    set({ pendingCommand: { label, before } });
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
    pushCommand(set, createDocumentCommand(label ?? pending.label, pending.before, after));
  },

  discardPendingCommand: () => set({ pendingCommand: null }),

  undo: () =>
    set((state) => {
      const command = state.undoStack.at(-1);
      if (!command) return {};
      const undoStack = state.undoStack.slice(0, -1);
      const redoStack = [...state.redoStack, command];
      return {
        ...snapshotState(command.before),
        undoStack,
        redoStack,
        canUndo: undoStack.length > 0,
        canRedo: true,
        pendingCommand: null,
        shapePreview: null,
        status: `Undo ${command.label}`,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    }),

  redo: () =>
    set((state) => {
      const command = state.redoStack.at(-1);
      if (!command) return {};
      const redoStack = state.redoStack.slice(0, -1);
      const undoStack = [...state.undoStack, command];
      return {
        ...snapshotState(command.after),
        undoStack,
        redoStack,
        canUndo: true,
        canRedo: redoStack.length > 0,
        pendingCommand: null,
        shapePreview: null,
        status: `Redo ${command.label}`,
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    }),

  switchToRoot: () =>
    set((state) => ({
      activeContext: { type: "root" },
      shapePreview: null,
      cursorLabel: "x: -- y: --",
      status: state.activeContext.type === "root" ? state.status : "Editing root canvas",
    })),

  switchToObject: (objectId) =>
    set((state) => {
      const object = state.objects.find((candidate) => candidate.id === objectId);
      if (!object) return { status: "Object was not found" };
      return {
        activeContext: { type: "object", objectId },
        shapePreview: null,
        cursorLabel: "x: -- y: --",
        status: `Editing ${object.name}`,
      };
    }),

  addObject: () => {
    const before = currentSnapshot();
    const object = createObjectDefinition(crypto.randomUUID(), `Object ${get().objects.length + 1}`, 32, 32);
    set((state) => ({
      objects: [...state.objects, object],
      activeContext: { type: "object", objectId: object.id },
      shapePreview: null,
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
      const layer = createLayer(stack.nextLayerId, `Layer ${stack.layers.length + 1}`, stack.width, stack.height);
      const layers = [...stack.layers];
      layers.splice(stack.activeLayerIndex + 1, 0, layer);
      return {
        ...replaceActiveStack(state, {
          ...stack,
          nextLayerId: stack.nextLayerId + 1,
          layers,
          activeLayerIndex: stack.activeLayerIndex + 1,
        }),
        status: "Layer added",
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
      const source = activeLayer(state);
      const layer = cloneLayer(source);
      layer.id = stack.nextLayerId;
      layer.name = `${source.name} copy`;
      const layers = [...stack.layers];
      layers.splice(stack.activeLayerIndex + 1, 0, layer);
      return {
        ...replaceActiveStack(state, {
          ...stack,
          nextLayerId: stack.nextLayerId + 1,
          layers,
          activeLayerIndex: stack.activeLayerIndex + 1,
        }),
        status: "Layer duplicated",
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
      if (stack.layers.length <= 1) return {};
      const layers = stack.layers.filter((_, index) => index !== stack.activeLayerIndex);
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers,
          activeLayerIndex: clampLayerIndex(stack.activeLayerIndex, layers.length),
        }),
        status: "Layer deleted",
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
      const target = stack.activeLayerIndex + direction;
      if (target < 0 || target >= stack.layers.length) return {};
      const layers = [...stack.layers];
      const [layer] = layers.splice(stack.activeLayerIndex, 1);
      layers.splice(target, 0, layer);
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers,
          activeLayerIndex: target,
        }),
        status: direction > 0 ? "Layer moved up" : "Layer moved down",
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, direction > 0 ? "Move layer up" : "Move layer down", before);
  },

  setActiveLayer: (activeLayerIndex) =>
    set((state) => {
      const stack = activeStack(state);
      const layer = stack.layers[activeLayerIndex];
      return {
        ...replaceActiveStack(state, { ...stack, activeLayerIndex }),
        status: layer?.type === "object" ? "Object instances are linked; edit the source object." : state.status,
      };
    }),

  renameLayer: (index, name) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, name } : layer)),
        }),
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
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, visible } : layer)),
        }),
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, visible ? "Show layer" : "Hide layer", before);
  },

  setLayerOpacity: (opacity) => {
    const state = get();
    if (!state.pendingCommand) get().beginCommand("Set layer opacity");
    set((current) => {
      const stack = activeStack(current);
      return {
        ...replaceActiveStack(current, {
          ...stack,
          layers: stack.layers.map((layer, index) =>
            index === stack.activeLayerIndex ? { ...layer, opacity } : layer,
          ),
        }),
        documentRevision: current.documentRevision + 1,
        viewRevision: current.viewRevision + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  commitLayerOpacity: () => get().commitCommand("Set layer opacity"),

  setStackBackground: (background) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      if (stack.background === background) return {};
      return {
        ...replaceActiveStack(state, { ...stack, background }),
        status: `Background ${PIXEL_VALUE_LABELS[background]}`,
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
      const layer = stack.layers[stack.activeLayerIndex];
      if (!isPixelEditableLayer(layer)) {
        return { status: "Active layer does not support pixel drawing" };
      }
      if (!layer.surface.data.some((pixel) => pixel !== TRANSPARENT_PIXEL)) {
        return { status: "Layer is already clear" };
      }
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((candidate, index) =>
            index === stack.activeLayerIndex
              ? {
                  ...layer,
                  contentRevision: layer.contentRevision + 1,
                  surface: { ...layer.surface, data: new Uint8Array(layer.surface.data.length) },
                }
              : candidate,
          ),
        }),
        status: "Layer cleared",
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
      const layer = stack.layers[stack.activeLayerIndex];
      if (!isPixelEditableLayer(layer)) {
        return { status: "Active layer does not support pixel drawing" };
      }
      if (!layer.surface.data.some((pixel) => pixel === BLACK_PIXEL || pixel === WHITE_PIXEL)) {
        return { status: "Layer has no black or white pixels to invert" };
      }
      const data = new Uint8Array(layer.surface.data.length);
      for (let pixel = 0; pixel < layer.surface.data.length; pixel += 1) {
        data[pixel] =
          layer.surface.data[pixel] === BLACK_PIXEL
            ? WHITE_PIXEL
            : layer.surface.data[pixel] === WHITE_PIXEL
              ? BLACK_PIXEL
              : TRANSPARENT_PIXEL;
      }
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((candidate, index) =>
            index === stack.activeLayerIndex
              ? { ...layer, contentRevision: layer.contentRevision + 1, surface: { ...layer.surface, data } }
              : candidate,
          ),
        }),
        status: "Layer inverted",
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
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      shapePreview: null,
      status: "New project",
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
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        shapePreview: null,
        status: "Project loaded",
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
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        shapePreview: null,
        status: "Most recent project loaded",
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

  exportProjectFile: () => {
    const state = get();
    const id = state.currentProjectId ?? crypto.randomUUID();
    const document = serializeProject(currentSnapshot(), id, state.projectName);
    downloadBlob(
      new Blob([exportProjectJson(document)], { type: "application/json" }),
      `${slugify(document.name)}.playdate-pixel.json`,
    );
    set({ status: "Project file exported" });
  },

  importProjectFile: async (file) => {
    try {
      const text = await file.text();
      const document = parseProjectJson(text);
      const snapshot = deserializeProject(document);
      const normalizedDocument = serializeProject(snapshot, document.id, document.name);
      const saved = await saveProjectDocument(normalizedDocument);
      set((state) => ({
        ...snapshotState(snapshot),
        projectName: document.name,
        currentProjectId: document.id,
        savedDocumentRevision: state.documentRevision + 1,
        pendingCommand: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        shapePreview: null,
        status: "Project imported",
        documentRevision: state.documentRevision + 1,
        viewRevision: state.viewRevision + 1,
        hasUnsavedChanges: false,
        recentProjects: mergeSummary(state.recentProjects, saved),
      }));
    } catch {
      set({ status: "Unable to import project file" });
    }
  },

  exportPng: () => {
    const state = get();
    const canvas = createPlaydatePngCanvas(state.root.layers, state.previewMode, state.objects, state.root.background);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${slugify(state.projectName)}.png`);
    }, "image/png");
    set({ status: "PNG exported" });
  },

  exportBundle: async () => {
    try {
      const state = get();
      const id = state.currentProjectId ?? crypto.randomUUID();
      const document = serializeProject(currentSnapshot(), id, state.projectName);
      const bundle = await createProjectBundle(document, state.root.layers, state.objects, state.root.background);
      downloadBlob(bundle, `${slugify(document.name)}.playdate-pixel.zip`);
      set({ status: "Project bundle exported" });
    } catch {
      set({ status: "Unable to export project bundle" });
    }
  },
}));

export function currentSnapshot(): EditorSnapshot {
  return snapshotFrom(useEditorStore.getState());
}

export function currentActiveStack(): LayerStack {
  return activeStack(useEditorStore.getState());
}

export function currentActiveLayer(): Layer {
  return activeLayer(useEditorStore.getState());
}

export function currentActivePixelLayer(): PixelLayer | null {
  return activePixelLayer(useEditorStore.getState());
}

function createInitialSnapshot(): EditorSnapshot {
  return {
    root: createRootStack(),
    objects: [],
    activeContext: { type: "root" },
  };
}

function pushCurrentCommand(set: typeof useEditorStore.setState, label: string, before: EditorSnapshot): void {
  const after = currentSnapshot();
  if (snapshotsEqual(before, after)) return;
  pushCommand(set, createDocumentCommand(label, before, after));
}

function pushCommand(set: typeof useEditorStore.setState, command: DocumentCommand): void {
  set((state) => {
    const undoStack = [...state.undoStack, command].slice(-80);
    return {
      undoStack,
      redoStack: [],
      pendingCommand: null,
      canUndo: undoStack.length > 0,
      canRedo: false,
      hasUnsavedChanges: true,
      status: command.label,
    };
  });
}

function snapshotFrom(snapshot: Pick<EditorSnapshot, "root" | "objects" | "activeContext">): EditorSnapshot {
  return cloneSnapshot({
    root: snapshot.root,
    objects: snapshot.objects,
    activeContext: snapshot.activeContext,
  });
}

function snapshotState(snapshot: EditorSnapshot): Pick<EditorStoreState, "root" | "objects" | "activeContext"> {
  const cloned = cloneSnapshot(snapshot);
  return {
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
  pencil: "Pencil",
  eraser: "Eraser",
  line: "Line",
  rect: "Rectangle",
  fill: "Fill",
  dither: "Dither",
};

const PIXEL_VALUE_LABELS: Record<PixelValue, string> = {
  [TRANSPARENT_PIXEL]: "transparent",
  [BLACK_PIXEL]: "black",
  [WHITE_PIXEL]: "white",
};
