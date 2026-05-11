import { useEditorStore } from "../state/editorStore";
import type { GestureTransaction } from "./gestureTypes";

export function beginGestureTransaction(label: string): GestureTransaction {
  useEditorStore.getState().beginCommand(label);
  return {
    label,
    commit: (changed, status) => {
      const state = useEditorStore.getState();
      if (changed) state.markDocumentChanged(status);
      state.commitCommand(label);
    },
    discard: () => {
      useEditorStore.getState().discardPendingCommand();
    },
  };
}
