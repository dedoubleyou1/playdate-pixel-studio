import { commandSelectionSnapshotsEqual, createEditorCommand, snapshotsEqual } from "../../domain/commands";
import {
  clearSelectedPixels,
  createClipboardFromSelection,
  pasteClipboardPixels,
  selectionFromClipboardMask,
} from "../../domain/clipboard";
import { activeLayer, activeStack, isPixelEditableLayer } from "../../domain/layers";
import {
  combineBinaryMaskSurface,
  createEllipseMask,
  createRectMask,
  createSelectionStateFromMask,
  maskIsEmpty,
} from "../../domain/masks";
import type { BinaryMaskSurface, SelectionCombineMode } from "../../domain/types";
import { readSelectionFromDesktopClipboard, writeSelectionToDesktopClipboard } from "../../desktop/desktopApi";
import { parseEditorClipboardJson, serializeEditorClipboard } from "../../persistence/clipboardSchema";
import {
  activeSelection,
  pushCommand,
  replaceActiveStack,
  selectionSnapshot,
  setActiveSelectionState,
  setActiveSelectionStateFields,
  snapshotFrom,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type MaskFactory = (width: number, height: number) => BinaryMaskSurface;

type SelectionActions = Pick<
  EditorStoreState,
  | "setActiveSelectionCombineMode"
  | "setSelectionFromRect"
  | "setSelectionFromEllipse"
  | "clearSelection"
  | "copySelection"
  | "cutSelection"
  | "pasteClipboard"
>;

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

export function createSelectionActions(set: EditorStoreSet, get: EditorStoreGet): SelectionActions {
  const setSelectionFromMask = (
    label: string,
    status: string,
    mode: SelectionCombineMode,
    createMask: MaskFactory,
  ): void => {
    const before = snapshotFrom(get());
    const beforeSelection = selectionSnapshot(get());
    set((state) => {
      const stack = activeStack(state);
      const combinedMask = combineBinaryMaskSurface(activeSelection(state)?.mask, createMask(stack.width, stack.height), mode);
      const selection = createSelectionStateFromMask(combinedMask);
      return setActiveSelectionState(state, selection.isEmpty ? null : selection, status);
    });
    const afterSelection = selectionSnapshot(get());
    pushCommand(
      set,
      createEditorCommand(label, before, snapshotFrom(get()), {
        afterSelection,
        beforeSelection,
      }),
    );
  };

  return {
    setActiveSelectionCombineMode: (activeSelectionCombineMode) => set({ activeSelectionCombineMode }),

    setSelectionFromRect: (start, end, mode = "replace") => {
      setSelectionFromMask(selectionCommandLabel(mode, "selection"), selectionStatus(mode), mode, (width, height) =>
        createRectMask(width, height, start, end),
      );
    },

    setSelectionFromEllipse: (start, end, mode = "replace") => {
      setSelectionFromMask(selectionCommandLabel(mode, "ellipse selection"), selectionStatus(mode), mode, (width, height) =>
        createEllipseMask(width, height, start, end),
      );
    },

    clearSelection: () => {
      const before = snapshotFrom(get());
      const beforeSelection = selectionSnapshot(get());
      set((state) => (activeSelection(state) ? setActiveSelectionState(state, null, "Selection cleared") : {}));
      pushCommand(
        set,
        createEditorCommand("Clear selection", before, snapshotFrom(get()), {
          afterSelection: selectionSnapshot(get()),
          beforeSelection,
        }),
      );
    },

    copySelection: async () => {
      const clipboard = clipboardFromCurrentSelection(get, set, "copy");
      if (!clipboard) return false;
      try {
        const json = serializeEditorClipboard(clipboard);
        await writeSelectionToDesktopClipboard(json);
        set({ status: "Selection copied" });
        return true;
      } catch {
        set({ status: "Unable to copy selection" });
        return false;
      }
    },

    cutSelection: async () => {
      const clipboard = clipboardFromCurrentSelection(get, set, "cut");
      if (!clipboard) return false;
      const before = snapshotFrom(get());
      const beforeSelection = selectionSnapshot(get());
      try {
        const json = serializeEditorClipboard(clipboard);
        await writeSelectionToDesktopClipboard(json);
      } catch {
        set({ status: "Unable to cut selection" });
        return false;
      }

      if (!snapshotsEqual(before, snapshotFrom(get())) || !commandSelectionSnapshotsEqual(beforeSelection, selectionSnapshot(get()))) {
        set({ status: "Selection changed before cut" });
        return false;
      }

      let changed = false;
      set((state) => {
        const selection = activeSelection(state);
        const layer = activeLayer(state);
        if (state.editTarget !== "pixels" || !selection || maskIsEmpty(selection.mask) || !isPixelEditableLayer(layer)) {
          return { status: "Unable to cut selection" };
        }

        const stack = activeStack(state);
        const sourceLayer = clearSelectedPixels(layer, selection);
        changed = !surfaceDataEqual(layer.surface.data, sourceLayer.surface.data);
        return {
          ...replaceActiveStack(state, {
            ...stack,
            layers: stack.layers.map((candidate, index) => (index === stack.activeLayerIndex ? sourceLayer : candidate)),
          }),
          status: "Selection cut",
          documentRevision: changed ? state.documentRevision + 1 : state.documentRevision,
          viewRevision: changed ? state.viewRevision + 1 : state.viewRevision,
          hasUnsavedChanges: changed ? true : state.hasUnsavedChanges,
        };
      });

      pushCommand(
        set,
        createEditorCommand("Cut selection", before, snapshotFrom(get()), {
          afterSelection: selectionSnapshot(get()),
          beforeSelection,
        }),
      );
      return true;
    },

    pasteClipboard: async () => {
      const state = get();
      const layer = activeLayer(state);
      if (!isPixelEditableLayer(layer)) {
        set({ status: "Select a pixel layer to paste" });
        return false;
      }

      let json: string | null;
      try {
        json = await readSelectionFromDesktopClipboard();
      } catch {
        set({ status: "Unable to read clipboard" });
        return false;
      }

      if (!json) {
        set({ status: "Clipboard does not contain a Pixel Studio selection" });
        return false;
      }

      const clipboard = parseEditorClipboardJson(json);
      if (!clipboard) {
        set({ status: "Clipboard does not contain a Pixel Studio selection" });
        return false;
      }

      const before = snapshotFrom(get());
      const beforeSelection = selectionSnapshot(get());
      let changed = false;
      set((current) => {
        const currentLayer = activeLayer(current);
        if (!isPixelEditableLayer(currentLayer)) return { status: "Select a pixel layer to paste" };

        const stack = activeStack(current);
        const pastedLayer = pasteClipboardPixels(currentLayer, clipboard);
        const nextSelection = selectionFromClipboardMask(clipboard, stack.width, stack.height);
        changed = !surfaceDataEqual(currentLayer.surface.data, pastedLayer.surface.data);
        return {
          ...replaceActiveStack(current, {
            ...stack,
            layers: stack.layers.map((candidate, index) => (index === stack.activeLayerIndex ? pastedLayer : candidate)),
          }),
          ...setActiveSelectionStateFields(current, nextSelection),
          status: "Selection pasted",
          documentRevision: changed ? current.documentRevision + 1 : current.documentRevision,
          viewRevision: current.viewRevision + 1,
          hasUnsavedChanges: changed ? true : current.hasUnsavedChanges,
        };
      });

      pushCommand(
        set,
        createEditorCommand("Paste selection", before, snapshotFrom(get()), {
          afterSelection: selectionSnapshot(get()),
          beforeSelection,
        }),
      );
      return true;
    },
  };
}

function clipboardFromCurrentSelection(
  get: EditorStoreGet,
  set: EditorStoreSet,
  action: "copy" | "cut",
): ReturnType<typeof createClipboardFromSelection> {
  const state = get();
  const selection = activeSelection(state);
  const layer = activeLayer(state);
  if (state.editTarget !== "pixels") {
    set({ status: `Switch to pixel editing to ${action} selection` });
    return null;
  }
  if (!selection || maskIsEmpty(selection.mask)) {
    set({ status: `Select pixels to ${action}` });
    return null;
  }
  if (!isPixelEditableLayer(layer)) {
    set({ status: `Select a pixel layer to ${action}` });
    return null;
  }
  return createClipboardFromSelection(layer, selection);
}

function surfaceDataEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
