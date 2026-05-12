import { Circle, CircleDashed, Eraser, Move, PaintBucket, Pencil, PenTool, Square, SquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { toolUsesBrushSize } from "../domain/toolProperties";
import type { EditTarget, PaletteEntry, PaletteIndex, ProjectPalette, Tool } from "../domain/types";
import { ObjectLibrary } from "./ObjectLibrary";
import { EditorControlRow, EditorPanel, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { PixelSwatch } from "./PixelSwatch";
import { useEditorStore } from "../state/editorStore";

interface ToolButtonConfig {
  tool: Tool;
  label: string;
  shortcut: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOL_GROUPS: Array<{ id: string; label: string; tools: ToolButtonConfig[] }> = [
  {
    id: "selection",
    label: "Selection and movement",
    tools: [
      { tool: "marquee", label: "Marquee", shortcut: "M", icon: SquareDashed },
      { tool: "ellipseSelect", label: "Ellipse Select", shortcut: "O", icon: CircleDashed },
      { tool: "move", label: "Move", shortcut: "V", icon: Move },
    ],
  },
  {
    id: "paint",
    label: "Paint tools",
    tools: [
      { tool: "pencil", label: "Pencil", shortcut: "P", icon: Pencil },
      { tool: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
      { tool: "fill", label: "Fill", shortcut: "F", icon: PaintBucket },
    ],
  },
  {
    id: "shape",
    label: "Shape tools",
    tools: [
      { tool: "line", label: "Line", shortcut: "L", icon: PenTool },
      { tool: "rect", label: "Rectangle", shortcut: "R", hint: "Shift for square", icon: Square },
      { tool: "ellipse", label: "Ellipse", shortcut: "C", hint: "Shift for circle", icon: Circle },
    ],
  },
];

const ICON_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,2.25rem)] gap-2";

export function ToolsPanel(): React.JSX.Element {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setTool = useEditorStore((state) => state.setTool);
  const palette = useEditorStore((state) => state.palette);
  const colorizedPatternsVisible = useEditorStore((state) => state.colorizedPatternsVisible);
  const activePaletteIndex = useEditorStore((state) => state.activePaletteIndex);
  const setActivePaletteIndex = useEditorStore((state) => state.setActivePaletteIndex);
  const brushSize = useEditorStore((state) => state.brushSize);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const layerSelected = useEditorStore((state) => Boolean(activeLayer(state)));
  const drawingEnabled = useEditorStore((state) => isPixelEditableLayer(activeLayer(state)));
  const editTarget = useEditorStore((state) => state.editTarget);
  const paletteEnabled = drawingEnabled && editTarget === "pixels";
  const propertiesEnabled = (drawingEnabled || editTarget === "alphaMask") && toolUsesBrushSize(activeTool);
  const paletteGroups = [
    {
      id: "solid",
      label: "Solid colors",
      entries: palette.entries.filter((entry) => entry.type === "solid"),
    },
    {
      id: "patterns",
      label: "Patterns",
      entries: palette.entries.filter((entry) => entry.type === "dither"),
    },
  ].filter((group) => group.entries.length > 0);

  return (
    <EditorPanel side="left" aria-label="Drawing tools">
      <EditorPane disabled={!layerSelected}>
        <EditorPaneTitle className="mb-3">Tools</EditorPaneTitle>
        <div className="space-y-3">
          {TOOL_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="space-y-3">
              {groupIndex > 0 ? <Separator /> : null}
              <div className={ICON_GRID_CLASS} aria-label={group.label}>
                {group.tools.map((tool) => (
                  <ToolButton
                    key={tool.tool}
                    activeTool={activeTool}
                    config={tool}
                    drawingEnabled={drawingEnabled}
                    editTarget={editTarget}
                    layerSelected={layerSelected}
                    onSelect={setTool}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </EditorPane>

      <SwatchesPane
        activePaletteIndex={activePaletteIndex}
        colorizedPatternsVisible={colorizedPatternsVisible}
        palette={palette}
        paletteEnabled={paletteEnabled}
        paletteGroups={paletteGroups}
        setActivePaletteIndex={setActivePaletteIndex}
      />

      <ToolPropertiesPane
        activeTool={activeTool}
        brushSize={brushSize}
        propertiesEnabled={propertiesEnabled}
        setBrushSize={setBrushSize}
      />
      <ObjectLibrary />
    </EditorPanel>
  );
}

function SwatchesPane({
  activePaletteIndex,
  colorizedPatternsVisible,
  palette,
  paletteEnabled,
  paletteGroups,
  setActivePaletteIndex,
}: {
  activePaletteIndex: PaletteIndex;
  colorizedPatternsVisible: boolean;
  palette: ProjectPalette;
  paletteEnabled: boolean;
  paletteGroups: Array<{ id: string; label: string; entries: PaletteEntry[] }>;
  setActivePaletteIndex: (index: PaletteEntry["index"]) => void;
}): React.JSX.Element {
  return (
    <EditorPane disabled={!paletteEnabled}>
      <EditorPaneTitle className="mb-3">Swatches</EditorPaneTitle>
      <div className="space-y-3">
        {paletteGroups.map((group, groupIndex) => (
          <div key={group.id} className="space-y-3">
            {groupIndex > 0 ? <Separator /> : null}
            <div className={ICON_GRID_CLASS} aria-label={group.label}>
              {group.entries.map((entry) => (
                <PaletteButton
                  key={entry.id}
                  active={activePaletteIndex === entry.index}
                  colorizedPatterns={colorizedPatternsVisible}
                  disabled={!paletteEnabled}
                  entry={entry}
                  onSelect={setActivePaletteIndex}
                  palette={palette}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </EditorPane>
  );
}

function ToolPropertiesPane({
  activeTool,
  brushSize,
  propertiesEnabled,
  setBrushSize,
}: {
  activeTool: Tool;
  brushSize: number;
  propertiesEnabled: boolean;
  setBrushSize: (size: number) => void;
}): React.JSX.Element {
  const hasBrushSize = toolUsesBrushSize(activeTool);

  return (
    <EditorPane disabled={!propertiesEnabled}>
      <EditorPaneTitle className="mb-3">{toolLabel(activeTool)} Properties</EditorPaneTitle>
      {hasBrushSize ? (
        <EditorControlRow>
          <Label>Size</Label>
          <Slider
            disabled={!propertiesEnabled}
            min={1}
            max={8}
            step={1}
            value={[brushSize]}
            onValueChange={([value]) => setBrushSize(value ?? 1)}
          />
          <strong className="text-right text-foreground">{brushSize}</strong>
        </EditorControlRow>
      ) : (
        <p className="text-sm text-muted-foreground">No properties</p>
      )}
    </EditorPane>
  );
}

function toolLabel(tool: Tool): string {
  return TOOL_GROUPS.flatMap((group) => group.tools).find((config) => config.tool === tool)?.label ?? "Tool";
}

function PaletteButton({
  active,
  colorizedPatterns,
  disabled,
  entry,
  onSelect,
  palette,
}: {
  active: boolean;
  colorizedPatterns: boolean;
  disabled: boolean;
  entry: PaletteEntry;
  onSelect: (index: PaletteEntry["index"]) => void;
  palette: ProjectPalette;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "outline"}
          size="icon"
          aria-label={`${entry.name} paint`}
          disabled={disabled}
          onClick={() => onSelect(entry.index)}
        >
          <PixelSwatch
            className="size-7"
            colorizedPatterns={colorizedPatterns}
            palette={palette}
            sampleSize={13}
            swatchSize={26}
            value={entry.index}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {entry.name}
        {entry.index === 3 ? " (D)" : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolButton({
  activeTool,
  config,
  drawingEnabled,
  editTarget,
  layerSelected,
  onSelect,
}: {
  activeTool: Tool;
  config: ToolButtonConfig;
  drawingEnabled: boolean;
  editTarget: EditTarget;
  layerSelected: boolean;
  onSelect: (tool: Tool) => void;
}): React.JSX.Element {
  const Icon = config.icon;
  const active =
    config.tool === "move"
      ? layerSelected && activeTool === config.tool
      : config.tool === "marquee" || config.tool === "ellipseSelect"
        ? activeTool === config.tool
        : drawingEnabled && activeTool === config.tool;
  const disabled =
    config.tool === "move"
      ? !layerSelected || editTarget === "alphaMask"
      : config.tool === "marquee" || config.tool === "ellipseSelect"
        ? false
        : !drawingEnabled && editTarget !== "alphaMask";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "outline"}
          size="icon"
          aria-label={config.label}
          disabled={disabled}
          onClick={() => onSelect(config.tool)}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {config.label} ({config.shortcut}
        {config.hint ? `, ${config.hint}` : ""})
      </TooltipContent>
    </Tooltip>
  );
}
