import { useEditorStore } from "../state/editorStore";
import { snapshotState } from "../state/editorStoreHelpers";
import type { GestureTransaction } from "./gestureTypes";

export function beginGestureTransaction(label: string): GestureTransaction {
  useEditorStore.getState().beginCommand(label);
  const before = useEditorStore.getState().pendingCommand?.before;
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
    rollback: () => {
      if (!before) {
        useEditorStore.getState().discardPendingCommand();
        return;
      }
      useEditorStore.setState({
        ...snapshotState(before),
        pendingCommand: null,
      });
    },
  };
}
