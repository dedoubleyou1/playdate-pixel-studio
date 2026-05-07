import {
  Archive,
  Download,
  FileDown,
  FilePlus2,
  PaintBucket,
  Pencil,
  RotateCcwSquare,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { activeLayer, isDrawableLayer } from "../domain/layers";
import type { Tool } from "../domain/types";
import { useEditorStore } from "../state/editorStore";

const TOOL_COMMANDS: Array<{ tool: Tool; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { tool: "pencil", label: "Pencil", icon: Pencil },
  { tool: "fill", label: "Fill", icon: PaintBucket },
  { tool: "rect", label: "Rectangle", icon: Square },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const setTool = useEditorStore((state) => state.setTool);
  const newProject = useEditorStore((state) => state.newProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const exportPng = useEditorStore((state) => state.exportPng);
  const exportProjectFile = useEditorStore((state) => state.exportProjectFile);
  const exportBundle = useEditorStore((state) => state.exportBundle);
  const clearActiveLayer = useEditorStore((state) => state.clearActiveLayer);
  const invertActiveLayer = useEditorStore((state) => state.invertActiveLayer);
  const drawingEnabled = useEditorStore((state) => isDrawableLayer(activeLayer(state)));

  const run = (action: () => void | Promise<void>) => {
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
          <CommandButton icon={Trash2} label="Clear active layer" onClick={() => run(clearActiveLayer)} />
          <CommandButton icon={RotateCcwSquare} label="Invert active layer" onClick={() => run(invertActiveLayer)} />
          {TOOL_COMMANDS.map((command) => (
            <CommandButton
              key={command.tool}
              icon={command.icon}
              label={`Select ${command.label}`}
              disabled={!drawingEnabled}
              onClick={() => run(() => setTool(command.tool))}
            />
          ))}
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
