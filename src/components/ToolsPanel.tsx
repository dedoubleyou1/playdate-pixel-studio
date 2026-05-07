import { Eraser, Grid2X2, PaintBucket, Pencil, Slash, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tool } from "../domain/types";
import { ObjectLibrary } from "./ObjectLibrary";
import { useEditorStore } from "../state/editorStore";

const TOOLS: Array<{ tool: Tool; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { tool: "pencil", label: "Pencil", icon: Pencil },
  { tool: "eraser", label: "Eraser", icon: Eraser },
  { tool: "line", label: "Line", icon: Slash },
  { tool: "rect", label: "Rectangle", icon: Square },
  { tool: "fill", label: "Fill", icon: PaintBucket },
  { tool: "dither", label: "Dither", icon: Grid2X2 },
];

export function ToolsPanel(): React.JSX.Element {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setTool = useEditorStore((state) => state.setTool);
  const brushSize = useEditorStore((state) => state.brushSize);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const mirrorX = useEditorStore((state) => state.mirrorX);
  const mirrorY = useEditorStore((state) => state.mirrorY);
  const setMirrorX = useEditorStore((state) => state.setMirrorX);
  const setMirrorY = useEditorStore((state) => state.setMirrorY);

  return (
    <aside className="tools-panel" aria-label="Drawing tools">
      <div className="panel-section">
        <h2>Tools</h2>
        <div className="tool-grid">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;

            return (
              <Tooltip key={tool.tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === tool.tool ? "secondary" : "outline"}
                    size="icon"
                    className={`tool-button${activeTool === tool.tool ? " is-active" : ""}`}
                    aria-label={tool.label}
                    onClick={() => setTool(tool.tool)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{tool.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <div className="panel-section">
        <h2>Brush</h2>
        <div className="control-row">
          <Label>Size</Label>
          <Slider min={1} max={8} step={1} value={[brushSize]} onValueChange={([value]) => setBrushSize(value ?? 1)} />
          <strong>{brushSize}</strong>
        </div>
        <ControlSwitch label="Mirror X" checked={mirrorX} onCheckedChange={setMirrorX} />
        <ControlSwitch label="Mirror Y" checked={mirrorY} onCheckedChange={setMirrorY} />
      </div>
      <ObjectLibrary />
    </aside>
  );
}

function ControlSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="toggle-row">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <Label>{label}</Label>
    </div>
  );
}
