import { Ellipsis, Eraser, PaintBucket, Pen, Pencil, PenTool, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { PixelValue, Tool } from "../domain/types";
import { ObjectLibrary } from "./ObjectLibrary";
import { EditorControlRow, EditorPanel, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { PixelSwatch } from "./PixelSwatch";
import { useEditorStore } from "../state/editorStore";

const TOOLS: Array<{ tool: Tool; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { tool: "pencil", label: "Pencil", icon: Pencil },
  { tool: "eraser", label: "Eraser", icon: Eraser },
  { tool: "line", label: "Line", icon: PenTool },
  { tool: "rect", label: "Rectangle", icon: Square },
  { tool: "fill", label: "Fill", icon: PaintBucket },
  { tool: "dither", label: "Dither", icon: DitherIcon },
];

const PAINT_VALUES: Array<{ label: string; value: PixelValue }> = [
  { label: "Black paint", value: BLACK_PIXEL },
  { label: "White paint", value: WHITE_PIXEL },
  { label: "Transparent paint", value: TRANSPARENT_PIXEL },
];

export function ToolsPanel(): React.JSX.Element {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setTool = useEditorStore((state) => state.setTool);
  const activePaintValue = useEditorStore((state) => state.activePaintValue);
  const setPaintValue = useEditorStore((state) => state.setPaintValue);
  const brushSize = useEditorStore((state) => state.brushSize);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const mirrorX = useEditorStore((state) => state.mirrorX);
  const mirrorY = useEditorStore((state) => state.mirrorY);
  const setMirrorX = useEditorStore((state) => state.setMirrorX);
  const setMirrorY = useEditorStore((state) => state.setMirrorY);
  const drawingEnabled = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));

  return (
    <EditorPanel side="left" aria-label="Drawing tools">
      <EditorPane disabled={!drawingEnabled}>
        <EditorPaneTitle className="mb-3">Tools</EditorPaneTitle>
        <div className="grid grid-cols-3 gap-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = drawingEnabled && activeTool === tool.tool;

            return (
              <Tooltip key={tool.tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={active ? "secondary" : "outline"}
                    size="icon"
                    aria-label={tool.label}
                    disabled={!drawingEnabled}
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
      </EditorPane>

      <EditorPane disabled={!drawingEnabled}>
        <EditorPaneTitle className="mb-3">Brush</EditorPaneTitle>
        <div className="mb-3.5 grid grid-cols-3 gap-2" aria-label="Paint value">
          {PAINT_VALUES.map((paint) => (
            <Tooltip key={paint.value}>
              <TooltipTrigger asChild>
                <Button
                  variant={activePaintValue === paint.value ? "secondary" : "outline"}
                  size="icon"
                  aria-label={paint.label}
                  disabled={!drawingEnabled}
                  onClick={() => setPaintValue(paint.value)}
                >
                  <PixelSwatch value={paint.value} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{paint.label}</TooltipContent>
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

function DitherIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <Pen />
      <Ellipsis x={-2} y={9.5} />
    </svg>
  );
}
