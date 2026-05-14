import { useEffect } from "react";
import { useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CanvasStage } from "./CanvasStage";
import { CommandPalette } from "./CommandPalette";
import { DesktopMenuBridge } from "./DesktopMenuBridge";
import { LayersPanel } from "./LayersPanel";
import { ToolsPanel } from "./ToolsPanel";
import { EditorShell, EditorWorkspace } from "./layout/editor-layout";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { FIRST_DITHER_PALETTE_INDEX } from "../domain/palette";
import { useAutosave } from "../hooks/useAutosave";
import { useEditorStore } from "../state/editorStore";

export function App(): React.JSX.Element {
  useAutosave();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [projectReady, setProjectReady] = useState(false);

  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setTool = useEditorStore((state) => state.setTool);
  const setActivePaletteIndex = useEditorStore((state) => state.setActivePaletteIndex);
  const saveProject = useEditorStore((state) => state.saveProject);
  const newProject = useEditorStore((state) => state.newProject);
  const loadMostRecentProject = useEditorStore((state) => state.loadMostRecentProject);
  const clearSelection = useEditorStore((state) => state.clearSelection);

  useEffect(() => {
    let canceled = false;

    void loadMostRecentProject().finally(() => {
      if (!canceled) setProjectReady(true);
    });

    return () => {
      canceled = true;
    };
  }, [loadMostRecentProject]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "s") {
        event.preventDefault();
        void saveProject();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "d") {
        event.preventDefault();
        clearSelection();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === "n") {
        event.preventDefault();
        newProject();
        return;
      }

      if (event.target instanceof HTMLInputElement) return;

      if (key === "d" && isPixelEditableLayer(activeLayer(useEditorStore.getState()))) {
        setActivePaletteIndex(FIRST_DITHER_PALETTE_INDEX);
        return;
      }

      const shortcuts = {
        v: "move",
        m: "marquee",
        o: "ellipseSelect",
        p: "pencil",
        b: "pencil",
        e: "eraser",
        l: "line",
        r: "rect",
        c: "ellipse",
        f: "fill",
      } as const;
      const tool = shortcuts[key as keyof typeof shortcuts];
      const state = useEditorStore.getState();
      if (
        tool &&
        (tool === "move" ||
          tool === "marquee" ||
          tool === "ellipseSelect" ||
          state.editTarget === "alphaMask" ||
          isPixelEditableLayer(activeLayer(state)))
      ) {
        setTool(tool);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, newProject, redo, saveProject, setActivePaletteIndex, setTool, undo]);

  if (!projectReady) {
    return <EditorShell aria-label="Opening recent project" />;
  }

  return (
    <TooltipProvider>
      <EditorShell>
        <DesktopMenuBridge />
        <DragDropProvider>
          <EditorWorkspace>
            <ToolsPanel />
            <CanvasStage />
            <LayersPanel />
          </EditorWorkspace>
        </DragDropProvider>
      </EditorShell>
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </TooltipProvider>
  );
}
