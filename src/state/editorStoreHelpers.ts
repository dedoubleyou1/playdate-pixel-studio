import {
  cloneCommandSelectionSnapshot,
  createEditorCommand,
  editorCommandChangesDocument,
  editorCommandHasChanges,
  type CommandSelectionSnapshot,
  type EditorCommand,
} from "../domain/commands";
import {
  activeStack,
  cloneLayerStack,
  cloneObjectDefinition,
  cloneSnapshot,
  createDefaultPalette,
  createRootStack,
} from "../domain/layers";
import { cloneSelectionState } from "../domain/masks";
import type {
  BinaryMaskSurface,
  EditContext,
  EditorSnapshot,
  Layer,
  LayerStack,
  ObjectDefinition,
  PixelLayer,
  SelectionCombineMode,
  SelectionState,
  Tool,
} from "../domain/types";
import type { ProjectSummary } from "../persistence/projectSchema";
import type { EditorStoreSet, EditorStoreState } from "./editorStoreTypes";

export function createInitialSnapshot(): EditorSnapshot {
  return {
    palette: createDefaultPalette(),
    root: createRootStack(),
    objects: [],
    activeContext: { type: "root" },
  };
}

export function snapshotFrom(
  snapshot: Pick<EditorSnapshot, "palette" | "root" | "objects" | "activeContext">,
): EditorSnapshot {
  return cloneSnapshot({
    palette: snapshot.palette,
    root: snapshot.root,
    objects: snapshot.objects,
    activeContext: snapshot.activeContext,
  });
}

export function snapshotState(
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

export function pushCurrentCommand(
  set: EditorStoreSet,
  getState: () => EditorStoreState,
  label: string,
  before: EditorSnapshot,
): void {
  const after = snapshotFrom(getState());
  if (editorCommandChangesDocument({ before, after }) === false) return;
  const selection = selectionSnapshot(getState());
  pushCommand(
    set,
    createEditorCommand(label, before, after, {
      beforeSelection: selection,
      afterSelection: selection,
    }),
  );
}

export function pushCommand(set: EditorStoreSet, command: EditorCommand): void {
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

export function selectionCommandLabel(mode: SelectionCombineMode, shape: string): string {
  if (mode === "add") return `Add ${shape}`;
  if (mode === "subtract") return `Subtract ${shape}`;
  return shape === "ellipse selection" ? "Set ellipse selection" : "Set selection";
}

export function selectionStatus(mode: SelectionCombineMode): string {
  if (mode === "add") return "Selection added";
  if (mode === "subtract") return "Selection subtracted";
  return "Selection created";
}

export type SelectionStateHost = {
  activeContext: EditContext;
  objectSelection: SelectionState | null;
  rootSelection: SelectionState | null;
};

export function activeSelection(state: SelectionStateHost): SelectionState | null {
  return state.activeContext.type === "root" ? state.rootSelection : state.objectSelection;
}

export function selectActiveSelection(state: SelectionStateHost): SelectionState | null {
  return activeSelection(state);
}

export function hasActiveSelection(state: SelectionStateHost): boolean {
  return activeSelection(state)?.isEmpty === false;
}

export function setActiveSelectionState(
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

export function setActiveSelectionStateFields(
  state: Pick<EditorStoreState, "activeContext">,
  selection: SelectionState | null,
): Pick<EditorStoreState, "rootSelection"> | Pick<EditorStoreState, "objectSelection"> {
  return state.activeContext.type === "root" ? { rootSelection: selection } : { objectSelection: selection };
}

export function selectionSnapshot(state: EditorStoreState): CommandSelectionSnapshot {
  return {
    objectSelection: cloneSelectionState(state.objectSelection),
    rootSelection: cloneSelectionState(state.rootSelection),
  };
}

export function commandSelectionState(
  selection: CommandSelectionSnapshot | undefined,
): Pick<EditorStoreState, "objectSelection" | "rootSelection"> | Record<string, never> {
  if (!selection) return {};
  const cloned = cloneCommandSelectionSnapshot(selection);
  return {
    objectSelection: cloned.objectSelection,
    rootSelection: cloned.rootSelection,
  };
}

export function layerAlphaMaskSize(layer: Layer, objects: ObjectDefinition[]): { width: number; height: number } | null {
  if (layer.type === "pixel") return { width: layer.surface.width, height: layer.surface.height };
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  return object ? { width: object.width, height: object.height } : null;
}

export function replaceActiveStack(
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

export function editContextsEqual(left: EditContext, right: EditContext): boolean {
  if (left.type !== right.type) return false;
  return left.type === "root" || left.objectId === (right as { objectId: string }).objectId;
}

export function bumpActiveLayerContent(state: EditorStoreState): Pick<EditorSnapshot, "root" | "objects"> {
  const stack = activeStack(state);
  return replaceActiveStack(state, {
    ...stack,
    layers: stack.layers.map((layer, index) =>
      index === stack.activeLayerIndex ? { ...layer, contentRevision: layer.contentRevision + 1 } : layer,
    ),
  });
}

export function isPixelLayer(layer: Layer): layer is PixelLayer {
  return layer.type === "pixel";
}

export function mergeSummary(summaries: ProjectSummary[], summary: ProjectSummary): ProjectSummary[] {
  return [summary, ...summaries.filter((project) => project.id !== summary.id)].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "playdate-pixel-art"
  );
}

export function clampObjectDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(400, Math.floor(value)));
}

export function contextLabel(context: EditContext, objects: ObjectDefinition[]): string {
  if (context.type === "root") return "Root Canvas";
  return objects.find((object) => object.id === context.objectId)?.name ?? "Missing Object";
}

export const TOOL_LABELS: Record<Tool, string> = {
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

export type MaskFactory = (width: number, height: number) => BinaryMaskSurface;
