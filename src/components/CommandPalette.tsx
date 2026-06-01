import {
  Archive,
  Circle,
  CircleDashed,
  ClipboardPaste,
  Copy,
  Download,
  FileDown,
  FilePlus2,
  Move,
  PaintBucket,
  Pencil,
  RotateCcwSquare,
  Save,
  Scissors,
  Square,
  SquareDashed,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { firstPatternPaletteIndex } from "../domain/palette";
import { BLACK_PIXEL } from "../domain/types";
import type { Tool } from "../domain/types";
import { hasActiveSelection, useEditorStore } from "../state/editorStore";

const TOOL_COMMANDS: Array<{ tool: Tool; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { tool: "move", label: "Move", icon: Move },
  { tool: "marquee", label: "Marquee", icon: SquareDashed },
  { tool: "ellipseSelect", label: "Ellipse Select", icon: CircleDashed },
  { tool: "pencil", label: "Pencil", icon: Pencil },
  { tool: "fill", label: "Fill", icon: PaintBucket },
  { tool: "rect", label: "Rectangle", icon: Square },
  { tool: "ellipse", label: "Ellipse", icon: Circle },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const setTool = useEditorStore((state) => state.setTool);
  const setActivePaletteIndex = useEditorStore((state) => state.setActivePaletteIndex);
  const newProject = useEditorStore((state) => state.newProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const exportPng = useEditorStore((state) => state.exportPng);
  const exportProjectFile = useEditorStore((state) => state.exportProjectFile);
  const exportBundle = useEditorStore((state) => state.exportBundle);
  const copySelection = useEditorStore((state) => state.copySelection);
  const cutSelection = useEditorStore((state) => state.cutSelection);
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const clearActiveLayer = useEditorStore((state) => state.clearActiveLayer);
  const invertActiveLayer = useEditorStore((state) => state.invertActiveLayer);
  const palette = useEditorStore((state) => state.palette);
  const layerSelected = useEditorStore((state) => Boolean(activeLayer(state)));
  const drawingEnabled = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));
  const hasSelection = useEditorStore(hasActiveSelection);

  const run = (action: () => void | Promise<unknown>) => {
    void action();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-dialog" aria-describedby="commandDescription">
        <DialogHeader>
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription id="commandDescription">Quick project, export, and tool actions</DialogDescription>
        </DialogHeader>
        <div className="command-list">
          <CommandButton icon={FilePlus2} label="New project" onClick={() => run(newProject)} />
          <CommandButton icon={Save} label="Save project" onClick={() => run(saveProject)} />
          <CommandButton icon={Download} label="Export PNG" onClick={() => run(exportPng)} />
          <CommandButton icon={FileDown} label="Export project JSON" onClick={() => run(exportProjectFile)} />
          <CommandButton icon={Archive} label="Export project bundle" onClick={() => run(exportBundle)} />
          <CommandButton
            icon={Copy}
            label="Copy selection"
            disabled={!hasSelection || !drawingEnabled}
            onClick={() => run(copySelection)}
          />
          <CommandButton
            icon={Scissors}
            label="Cut selection"
            disabled={!hasSelection || !drawingEnabled}
            onClick={() => run(cutSelection)}
          />
          <CommandButton
            icon={ClipboardPaste}
            label="Paste selection"
            disabled={!drawingEnabled}
            onClick={() => run(pasteClipboard)}
          />
          <CommandButton
            icon={SquareDashed}
            label="Clear selection"
            disabled={!hasSelection}
            onClick={() => run(clearSelection)}
          />
          <CommandButton
            icon={Trash2}
            label="Clear active layer"
            disabled={!drawingEnabled}
            onClick={() => run(clearActiveLayer)}
          />
          <CommandButton
            icon={RotateCcwSquare}
            label="Invert active layer"
            disabled={!drawingEnabled}
            onClick={() => run(invertActiveLayer)}
          />
          {TOOL_COMMANDS.map((command) => (
            <CommandButton
              key={command.tool}
              icon={command.icon}
              label={`Select ${command.label}`}
              disabled={
                command.tool === "move"
                  ? !layerSelected
                  : command.tool === "marquee" || command.tool === "ellipseSelect"
                    ? false
                    : !drawingEnabled
              }
              onClick={() => run(() => setTool(command.tool))}
            />
          ))}
          <CommandButton
            icon={Pencil}
            label="Select black paint"
            disabled={!drawingEnabled}
            onClick={() => run(() => setActivePaletteIndex(BLACK_PIXEL))}
          />
          <CommandButton
            icon={Pencil}
            label="Select pattern swatch"
            disabled={!drawingEnabled || firstPatternPaletteIndex(palette) === null}
            onClick={() =>
              run(() => {
                const patternIndex = firstPatternPaletteIndex(palette);
                if (patternIndex !== null) setActivePaletteIndex(patternIndex);
              })
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Button variant="outline" className="w-full justify-start" disabled={disabled} onClick={onClick}>
      <Icon />
      {label}
    </Button>
  );
}
