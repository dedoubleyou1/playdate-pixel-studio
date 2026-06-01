import { createEditorCommand } from "../../domain/commands";
import {
  createPatternSwatch,
  deletePatternSwatch,
  duplicatePatternSwatch,
  fallbackActiveSwatchRef,
  snapshotUsesSwatchRef,
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
        activeSwatchRef: result.entry?.ref ?? state.activeSwatchRef,
        documentRevision: state.documentRevision + 1,
        hasUnsavedChanges: true,
        palette: result.palette,
        status: result.status,
        viewRevision: state.viewRevision + 1,
      }));
      pushPaletteCommand(set, get, before, "Add pattern swatch");
    },

    updatePatternSwatch: (ref, updates) => {
      const before = snapshotFrom(get());
      const result = updatePatternSwatch(before.palette, ref, updates);
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

    duplicatePatternSwatch: (ref) => {
      const before = snapshotFrom(get());
      const result = duplicatePatternSwatch(before.palette, ref);
      if (!result?.entry) {
        set({ status: "Unable to duplicate pattern swatch" });
        return;
      }
      set((state) => ({
        activeSwatchRef: result.entry?.ref ?? state.activeSwatchRef,
        documentRevision: state.documentRevision + 1,
        hasUnsavedChanges: true,
        palette: result.palette,
        status: result.status,
        viewRevision: state.viewRevision + 1,
      }));
      pushPaletteCommand(set, get, before, "Duplicate pattern swatch");
    },

    deletePatternSwatch: (ref) => {
      const before = snapshotFrom(get());
      const used = snapshotUsesSwatchRef(before, ref);
      if (used && typeof window !== "undefined" && !window.confirm("Rasterize used pixels and delete this pattern swatch?")) {
        set({ status: "Pattern swatch deletion cancelled" });
        return;
      }
      const result = deletePatternSwatch(before, ref);
      if (!result) {
        set({ status: "Unable to delete pattern swatch" });
        return;
      }
      const nextActiveSwatchRef = fallbackActiveSwatchRef(result.value.palette, get().activeSwatchRef);
      set((state) => ({
        ...snapshotState(result.value),
        activeSwatchRef: nextActiveSwatchRef,
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
