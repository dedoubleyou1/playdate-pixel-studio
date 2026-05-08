import { Eraser, Move, PaintBucket, Pencil, PenTool, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import type { Tool } from "../domain/types";
import { ObjectLibrary } from "./ObjectLibrary";
import { EditorControlRow, EditorPanel, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { PixelSwatch } from "./PixelSwatch";
import { useEditorStore } from "../state/editorStore";

const TOOLS: Array<{
  tool: Tool;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { tool: "pencil", label: "Pencil", shortcut: "P", icon: Pencil },
  { tool: "move", label: "Move", shortcut: "V", icon: Move },
  { tool: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  { tool: "line", label: "Line", shortcut: "L", icon: PenTool },
  { tool: "rect", label: "Rectangle", shortcut: "R", icon: Square },
  { tool: "fill", label: "Fill", shortcut: "F", icon: PaintBucket },
];

export function ToolsPanel(): React.JSX.Element {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setTool = useEditorStore((state) => state.setTool);
  const palette = useEditorStore((state) => state.palette);
  const activePaletteIndex = useEditorStore((state) => state.activePaletteIndex);
  const setActivePaletteIndex = useEditorStore((state) => state.setActivePaletteIndex);
  const brushSize = useEditorStore((state) => state.brushSize);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const mirrorX = useEditorStore((state) => state.mirrorX);
  const mirrorY = useEditorStore((state) => state.mirrorY);
  const setMirrorX = useEditorStore((state) => state.setMirrorX);
  const setMirrorY = useEditorStore((state) => state.setMirrorY);
  const layerSelected = useEditorStore((state) => Boolean(activeLayer(state)));
  const drawingEnabled = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));

  return (
    <EditorPanel side="left" aria-label="Drawing tools">
      <EditorPane disabled={!layerSelected}>
        <EditorPaneTitle className="mb-3">Tools</EditorPaneTitle>
        <div className="grid grid-cols-3 gap-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active =
              tool.tool === "move"
                ? layerSelected && activeTool === tool.tool
                : drawingEnabled && activeTool === tool.tool;
            const disabled = tool.tool === "move" ? !layerSelected : !drawingEnabled;

            return (
              <Tooltip key={tool.tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={active ? "secondary" : "outline"}
                    size="icon"
                    aria-label={tool.label}
                    disabled={disabled}
                    onClick={() => setTool(tool.tool)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {tool.label} ({tool.shortcut})
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </EditorPane>

      <EditorPane disabled={!drawingEnabled}>
        <EditorPaneTitle className="mb-3">Brush</EditorPaneTitle>
        <div className="mb-3.5 grid grid-cols-3 gap-2" aria-label="Palette">
          {palette.entries.map((entry) => (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activePaletteIndex === entry.index ? "secondary" : "outline"}
                  size="icon"
                  aria-label={`${entry.name} paint`}
                  disabled={!drawingEnabled}
                  onClick={() => setActivePaletteIndex(entry.index)}
                >
                  <PixelSwatch palette={palette} value={entry.index} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {entry.name}
                {entry.index === 3 ? " (D)" : ""}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <EditorControlRow>
          <Label>Size</Label>
          <Slider
            disabled={!drawingEnabled}
            min={1}
            max={8}
            step={1}
            value={[brushSize]}
            onValueChange={([value]) => setBrushSize(value ?? 1)}
          />
          <strong className="text-right text-foreground">{brushSize}</strong>
        </EditorControlRow>
        <ControlSwitch label="Mirror X" checked={mirrorX} disabled={!drawingEnabled} onCheckedChange={setMirrorX} />
        <ControlSwitch label="Mirror Y" checked={mirrorY} disabled={!drawingEnabled} onCheckedChange={setMirrorY} />
      </EditorPane>
      <ObjectLibrary />
    </EditorPanel>
  );
}

function ControlSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      <Label>{label}</Label>
    </div>
  );
}
