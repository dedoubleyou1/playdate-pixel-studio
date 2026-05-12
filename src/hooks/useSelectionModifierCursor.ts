import { useCallback, useEffect, useState } from "react";
import type { SelectionCombineMode } from "../domain/types";
import { selectionCombineModeForModifiers } from "../input/gestureTypes";

interface SelectionModifierState {
  hoverSelectionCombineMode: SelectionCombineMode | null;
  clearSelectionModifierCursor: () => void;
  updateSelectionModifierCursor: (modifiers: { altKey?: boolean; shiftKey: boolean }) => void;
}

export function useSelectionModifierCursor(): SelectionModifierState {
  const [hoverSelectionCombineMode, setHoverSelectionCombineMode] = useState<SelectionCombineMode | null>(null);

  const updateSelectionModifierCursor = useCallback((modifiers: { altKey?: boolean; shiftKey: boolean }) => {
    setHoverSelectionCombineMode(selectionCursorModeFromModifiers(modifiers));
  }, []);

  const clearSelectionModifierCursor = useCallback(() => {
    setHoverSelectionCombineMode(null);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", updateSelectionModifierCursor);
    window.addEventListener("keyup", updateSelectionModifierCursor);
    window.addEventListener("blur", clearSelectionModifierCursor);

    return () => {
      window.removeEventListener("keydown", updateSelectionModifierCursor);
      window.removeEventListener("keyup", updateSelectionModifierCursor);
      window.removeEventListener("blur", clearSelectionModifierCursor);
    };
  }, [clearSelectionModifierCursor, updateSelectionModifierCursor]);

  return {
    clearSelectionModifierCursor,
    hoverSelectionCombineMode,
    updateSelectionModifierCursor,
  };
}

function selectionCursorModeFromModifiers(modifiers: { altKey?: boolean; shiftKey: boolean }): SelectionCombineMode | null {
  const mode = selectionCombineModeForModifiers(modifiers);
  return mode === "replace" ? null : mode;
}
