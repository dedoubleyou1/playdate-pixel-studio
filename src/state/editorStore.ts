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
  isDrawableLayer,
  resizeSurface,
} from "../domain/layers";
import type {
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
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

interface EditorStoreState extends EditorSnapshot {
  activeTool: Tool;
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
  revision: number;
  savedRevision: number;
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
  markDocumentChanged: (status?: string) => void;
  beginCommand: (label: string) => void;
  commitCommand: (label?: string) => void;
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
  setLayerLocked: (index: number, locked: boolean) => void;
  setLayerOpacity: (opacity: number) => void;
  commitLayerOpacity: () => void;
  clearActiveLayer: () => void;
  invertActiveLayer: () => void;
  openPreview: () => void;
  closePreview: () => void;
  newProject: () => void;
  renameProject: (name: string) => void;
  saveProject: () => Promise<void>;
  loadProject: (id: string) => Promise<void>;
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
  brushSize: 1,
  mirrorX: false,
  mirrorY: false,
  gridVisible: true,
  gridSize: 1,
  zoom: 3,
  status: "Pencil ready",
  cursorLabel: "x: -- y: --",
  previewOpen: false,
  previewMode: "normal",
  shapePreview: null,
  revision: 0,
  savedRevision: 0,
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
      isDrawableLayer(activeLayer(state))
        ? { activeTool: tool, status: `${TOOL_LABELS[tool]} ready` }
        : { status: "Active layer is not editable" },
    ),
  setBrushSize: (brushSize) => set({ brushSize }),
  setMirrorX: (mirrorX) => set({ mirrorX }),
  setMirrorY: (mirrorY) => set({ mirrorY }),
  setGridVisible: (gridVisible) => set({ gridVisible }),
  setGridSize: (gridSize) => set({ gridSize }),
  setZoom: (zoom) => set({ zoom }),
  setStatus: (status) => set({ status }),
  setCursorLabel: (cursorLabel) => set({ cursorLabel }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setShapePreview: (shapePreview) => set((state) => ({ shapePreview, revision: state.revision + 1 })),

  markDocumentChanged: (status) =>
    set((state) => ({
      ...touchActiveStack(state),
      status: status ?? state.status,
      revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
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
      revision: state.revision + 1,
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
      revision: state.revision + 1,
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
                surface: resizeSurface(layer.surface, nextWidth, nextHeight),
              })),
            }
          : object,
      ),
      status: "Object resized",
      revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
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
        revision: state.revision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, visible ? "Show layer" : "Hide layer", before);
  },

  setLayerLocked: (index, locked) => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, locked } : layer)),
        }),
        revision: state.revision + 1,
        hasUnsavedChanges: true,
      };
    });
    pushCurrentCommand(set, locked ? "Lock layer" : "Unlock layer", before);
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
        revision: current.revision + 1,
        hasUnsavedChanges: true,
      };
    });
  },

  commitLayerOpacity: () => get().commitCommand("Set layer opacity"),

  clearActiveLayer: () => {
    const before = currentSnapshot();
    set((state) => {
      const stack = activeStack(state);
      const layer = stack.layers[stack.activeLayerIndex];
      if (layer?.type !== "pixel") {
        return { status: "Object instances are linked; edit the source object." };
      }
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((candidate, index) =>
            index === stack.activeLayerIndex
              ? {
                  ...layer,
                  surface: { ...layer.surface, data: new Uint8Array(layer.surface.data.length) },
                }
              : candidate,
          ),
        }),
        status: "Layer cleared",
        revision: state.revision + 1,
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
      if (layer?.type !== "pixel") {
        return { status: "Object instances are linked; edit the source object." };
      }
      const data = new Uint8Array(layer.surface.data.length);
      for (let pixel = 0; pixel < layer.surface.data.length; pixel += 1) {
        data[pixel] = layer.surface.data[pixel] === 1 ? 0 : 1;
      }
      return {
        ...replaceActiveStack(state, {
          ...stack,
          layers: stack.layers.map((candidate, index) =>
            index === stack.activeLayerIndex ? { ...layer, surface: { ...layer.surface, data } } : candidate,
          ),
        }),
        status: "Layer inverted",
        revision: state.revision + 1,
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
      savedRevision: state.revision + 1,
      pendingCommand: null,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      shapePreview: null,
      status: "New project",
      revision: state.revision + 1,
      hasUnsavedChanges: false,
    }));
  },

  renameProject: (projectName) => set({ projectName, hasUnsavedChanges: true }),

  saveProject: async () => {
    try {
      const state = get();
      const id = state.currentProjectId ?? crypto.randomUUID();
      const document = serializeProject(currentSnapshot(), id, state.projectName);
      const summary = await saveProjectDocument(document);
      set((current) => ({
        currentProjectId: id,
        projectName: document.name,
        savedRevision: current.revision,
        hasUnsavedChanges: false,
        status: "Project saved locally",
        recentProjects: mergeSummary(current.recentProjects, summary),
      }));
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
        savedRevision: state.revision + 1,
        pendingCommand: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        shapePreview: null,
        status: "Project loaded",
        revision: state.revision + 1,
        hasUnsavedChanges: false,
      }));
    } catch {
      set({ status: "Unable to load project" });
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
        savedRevision: state.revision + 1,
        pendingCommand: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        shapePreview: null,
        status: "Project imported",
        revision: state.revision + 1,
        hasUnsavedChanges: false,
        recentProjects: mergeSummary(state.recentProjects, saved),
      }));
    } catch {
      set({ status: "Unable to import project file" });
    }
  },

  exportPng: () => {
    const state = get();
    const canvas = createPlaydatePngCanvas(state.root.layers, state.previewMode, state.objects);
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
      const bundle = await createProjectBundle(document, state.root.layers, state.objects);
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

function touchActiveStack(state: EditorStoreState): Pick<EditorSnapshot, "root" | "objects"> {
  return replaceActiveStack(state, activeStack(state));
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
