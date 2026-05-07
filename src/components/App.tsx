import { useEffect } from "react";
import { useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CanvasStage } from "./CanvasStage";
import { CommandPalette } from "./CommandPalette";
import { LayersPanel } from "./LayersPanel";
import { ToolsPanel } from "./ToolsPanel";
import { Topbar } from "./Topbar";
import { EditorShell, EditorWorkspace } from "./layout/editor-layout";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { useAutosave } from "../hooks/useAutosave";
import { useEditorStore } from "../state/editorStore";

export function App(): React.JSX.Element {
  useAutosave();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [projectReady, setProjectReady] = useState(false);

  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setTool = useEditorStore((state) => state.setTool);
  const saveProject = useEditorStore((state) => state.saveProject);
  const newProject = useEditorStore((state) => state.newProject);
  const loadMostRecentProject = useEditorStore((state) => state.loadMostRecentProject);

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

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === "n") {
        event.preventDefault();
        newProject();
        return;
      }

      if (event.target instanceof HTMLInputElement) return;

      const shortcuts = {
        p: "pencil",
        b: "pencil",
        e: "eraser",
        l: "line",
        r: "rect",
        f: "fill",
        d: "dither",
      } as const;
      const tool = shortcuts[key as keyof typeof shortcuts];
      if (tool && isPixelEditableLayer(activeLayer(useEditorStore.getState()))) setTool(tool);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newProject, redo, saveProject, setTool, undo]);

  if (!projectReady) {
    return <EditorShell aria-label="Opening recent project" />;
  }

  return (
    <TooltipProvider>
      <EditorShell>
        <Topbar />
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
