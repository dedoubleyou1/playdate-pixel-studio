import { createEditorCommand } from "../../domain/commands";
import { activeStack } from "../../domain/layers";
import {
  combineBinaryMaskSurface,
  createEllipseMask,
  createRectMask,
  createSelectionStateFromMask,
} from "../../domain/masks";
import type { BinaryMaskSurface, SelectionCombineMode } from "../../domain/types";
import {
  activeSelection,
  pushCommand,
  selectionSnapshot,
  setActiveSelectionState,
  snapshotFrom,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type MaskFactory = (width: number, height: number) => BinaryMaskSurface;

type SelectionActions = Pick<
  EditorStoreState,
  "setActiveSelectionCombineMode" | "setSelectionFromRect" | "setSelectionFromEllipse" | "clearSelection"
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
  };
}
