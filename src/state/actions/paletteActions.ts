import { createEditorCommand } from "../../domain/commands";
import {
  createPatternSwatch,
  deletePatternSwatch,
  duplicatePatternSwatch,
  fallbackActivePaletteIndex,
  snapshotUsesPaletteIndex,
  updatePatternSwatch,
} from "../../domain/paletteCommands";
import { pushCommand, selectionSnapshot, snapshotFrom, snapshotState } from "../editorStoreHelpers";
import type { EditorStoreGet, EditorStoreSet, EditorStoreState } from "../editorStoreTypes";

type PaletteActions = Pick<
  EditorStoreState,
  "addPatternSwatch" | "deletePatternSwatch" | "duplicatePatternSwatch" | "updatePatternSwatch"
>;

export function createPaletteActions(set: EditorStoreSet, get: EditorStoreGet): PaletteActions {
  return {
    addPatternSwatch: (patternId, sampling) => {
      const before = snapshotFrom(get());
      const result = createPatternSwatch(before.palette, patternId, sampling);
      if (!result?.entry) {
        set({ status: "Unable to add pattern swatch" });
        return;
      }
      set((state) => ({
        activePaletteIndex: result.entry?.index ?? state.activePaletteIndex,
        documentRevision: state.documentRevision + 1,
        hasUnsavedChanges: true,
        palette: result.palette,
        status: result.status,
        viewRevision: state.viewRevision + 1,
      }));
      pushPaletteCommand(set, get, before, "Add pattern swatch");
    },

    updatePatternSwatch: (index, updates) => {
      const before = snapshotFrom(get());
      const result = updatePatternSwatch(before.palette, index, updates);
      if (!result) {
        set({ status: "Unable to update pattern swatch" });
        return;
      }
      set((state) => ({
        documentRevision: state.documentRevision + 1,
        hasUnsavedChanges: true,
        palette: result.palette,
        status: result.status,
        viewRevision: state.viewRevision + 1,
      }));
      pushPaletteCommand(set, get, before, "Edit pattern swatch");
    },

    duplicatePatternSwatch: (index) => {
      const before = snapshotFrom(get());
      const result = duplicatePatternSwatch(before.palette, index);
      if (!result?.entry) {
        set({ status: "Unable to duplicate pattern swatch" });
        return;
      }
      set((state) => ({
        activePaletteIndex: result.entry?.index ?? state.activePaletteIndex,
        documentRevision: state.documentRevision + 1,
        hasUnsavedChanges: true,
        palette: result.palette,
        status: result.status,
        viewRevision: state.viewRevision + 1,
      }));
      pushPaletteCommand(set, get, before, "Duplicate pattern swatch");
    },

    deletePatternSwatch: (index) => {
      const before = snapshotFrom(get());
      const used = snapshotUsesPaletteIndex(before, index);
      if (used && typeof window !== "undefined" && !window.confirm("Rasterize used pixels and delete this pattern swatch?")) {
        set({ status: "Pattern swatch deletion cancelled" });
        return;
      }
      const result = deletePatternSwatch(before, index);
      if (!result) {
        set({ status: "Unable to delete pattern swatch" });
        return;
      }
      const nextActivePaletteIndex = fallbackActivePaletteIndex(result.value.palette, get().activePaletteIndex);
      set((state) => ({
        ...snapshotState(result.value),
        activePaletteIndex: nextActivePaletteIndex,
        documentRevision: state.documentRevision + 1,
        hasUnsavedChanges: true,
        status: used ? "Pattern swatch rasterized and deleted" : "Pattern swatch deleted",
        viewRevision: state.viewRevision + 1,
      }));
      pushPaletteCommand(set, get, before, "Delete pattern swatch");
    },
  };
}

function pushPaletteCommand(set: EditorStoreSet, get: EditorStoreGet, before: ReturnType<typeof snapshotFrom>, label: string): void {
  pushCommand(
    set,
    createEditorCommand(label, before, snapshotFrom(get()), {
      beforeSelection: selectionSnapshot(get()),
      afterSelection: selectionSnapshot(get()),
    }),
  );
}
