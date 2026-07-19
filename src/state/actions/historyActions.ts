import { createEditorCommand, editorCommandChangesDocument, snapshotsEqual } from "../../domain/commands";
import {
  bumpActiveLayerContent,
  commandSelectionState,
  pushCommand,
  selectionSnapshot,
  snapshotFrom,
  snapshotState,
} from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type HistoryActions = Pick<
  EditorStoreState,
  "markViewChanged" | "markDocumentChanged" | "beginCommand" | "commitCommand" | "discardPendingCommand" | "undo" | "redo"
>;

export function createHistoryActions(set: EditorStoreSet, get: EditorStoreGet): HistoryActions {
  return {
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
      set({ pendingCommand: { label, before: snapshotFrom(get()), beforeSelection: selectionSnapshot(get()) } });
    },

    commitCommand: (label) => {
      const state = get();
      const pending = state.pendingCommand;
      if (!pending) return;
      const after = snapshotFrom(get());
      if (snapshotsEqual(pending.before, after)) {
        set({ pendingCommand: null });
        return;
      }
      pushCommand(
        set,
        createEditorCommand(label ?? pending.label, pending.before, after, {
          beforeSelection: pending.beforeSelection,
          afterSelection: selectionSnapshot(get()),
        }),
      );
    },

    discardPendingCommand: () => set({ pendingCommand: null }),

    undo: () =>
      set((state) => {
        if (state.gestureActive) return {};
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
          activeSelectionCombineMode: null,
          status: `Undo ${command.label}`,
          documentRevision: changesDocument ? state.documentRevision + 1 : state.documentRevision,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: changesDocument ? true : state.hasUnsavedChanges,
        };
      }),

    redo: () =>
      set((state) => {
        if (state.gestureActive) return {};
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
          activeSelectionCombineMode: null,
          status: `Redo ${command.label}`,
          documentRevision: changesDocument ? state.documentRevision + 1 : state.documentRevision,
          viewRevision: state.viewRevision + 1,
          hasUnsavedChanges: changesDocument ? true : state.hasUnsavedChanges,
        };
      }),
  };
}
