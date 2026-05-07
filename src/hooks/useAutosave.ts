import { useEffect } from "react";
import { useEditorStore } from "../state/editorStore";

const AUTOSAVE_DELAY_MS = 1500;

export function useAutosave(): void {
  const hasUnsavedChanges = useEditorStore((state) => state.hasUnsavedChanges);
  const revision = useEditorStore((state) => state.revision);
  const saveProject = useEditorStore((state) => state.saveProject);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timeout = window.setTimeout(() => {
      void saveProject();
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [hasUnsavedChanges, revision, saveProject]);
}
