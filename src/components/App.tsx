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
import { swatchRefForNumberShortcut } from "../domain/palette";
import { useAutosave } from "../hooks/useAutosave";
import { isRendererShortcutBlockedDuringGesture } from "../input/gestureShortcutGuards";
import { useEditorStore } from "../state/editorStore";

export function App(): React.JSX.Element {
  useAutosave();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [projectReady, setProjectReady] = useState(false);

  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const setTool = useEditorStore((state) => state.setTool);
  const setActiveSwatchRef = useEditorStore((state) => state.setActiveSwatchRef);
  const saveProject = useEditorStore((state) => state.saveProject);
  const newProject = useEditorStore((state) => state.newProject);
  const loadMostRecentProject = useEditorStore((state) => state.loadMostRecentProject);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const copySelection = useEditorStore((state) => state.copySelection);
  const cutSelection = useEditorStore((state) => state.cutSelection);
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard);
  const setColorizedPatternsModifierActive = useEditorStore((state) => state.setColorizedPatternsModifierActive);

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
      if (event.key === "Shift") {
        setColorizedPatternsModifierActive(true);
      }

      const key = event.key.toLowerCase();
      const primaryModifier = event.metaKey || event.ctrlKey;
      if (
        useEditorStore.getState().gestureActive &&
        isRendererShortcutBlockedDuringGesture({
          key,
          primaryModifier,
          shiftKey: event.shiftKey,
          textEditing: isTextEditingTarget(event.target),
        })
      ) {
        event.preventDefault();
        return;
      }
      if (primaryModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (primaryModifier && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (primaryModifier && key === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if (primaryModifier && key === "s") {
        event.preventDefault();
        void saveProject();
        return;
      }

      if (shouldHandleRendererClipboardShortcut(event, key, "c")) {
        event.preventDefault();
        void copySelection();
        return;
      }

      if (shouldHandleRendererClipboardShortcut(event, key, "x")) {
        event.preventDefault();
        void cutSelection();
        return;
      }

      if (shouldHandleRendererClipboardShortcut(event, key, "v")) {
        event.preventDefault();
        void pasteClipboard();
        return;
      }

      if (primaryModifier && key === "d") {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (primaryModifier && event.shiftKey && key === "n") {
        event.preventDefault();
        newProject();
        return;
      }

      if (isTextEditingTarget(event.target)) return;

      const state = useEditorStore.getState();
      if (!event.metaKey && !event.ctrlKey && !event.altKey && state.editTarget === "pixels" && isPixelEditableLayer(activeLayer(state))) {
        const swatchRef = swatchRefForNumberShortcut(state.palette, key);
        if (swatchRef !== null) {
          event.preventDefault();
          setActiveSwatchRef(swatchRef);
          return;
        }
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
      if (
        tool &&
        (tool === "move" ||
          tool === "marquee" ||
          tool === "ellipseSelect" ||
          state.editTarget === "alphaMask" ||
          isPixelEditableLayer(activeLayer(state)))
      ) {
        setTool(tool);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSelection,
    copySelection,
    cutSelection,
    newProject,
    pasteClipboard,
    redo,
    saveProject,
    setActiveSwatchRef,
    setColorizedPatternsModifierActive,
    setTool,
    undo,
  ]);

  useEffect(() => {
    const clearShiftPreview = () => setColorizedPatternsModifierActive(false);
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") clearShiftPreview();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearShiftPreview();
    };

    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearShiftPreview);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearShiftPreview);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearShiftPreview();
    };
  }, [setColorizedPatternsModifierActive]);

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

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target.isContentEditable;
}

function shouldHandleRendererClipboardShortcut(event: KeyboardEvent, key: string, shortcut: "c" | "x" | "v"): boolean {
  return (event.metaKey || event.ctrlKey) && key === shortcut && !isTextEditingTarget(event.target);
}
