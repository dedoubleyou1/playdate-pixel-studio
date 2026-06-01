import { useMemo, useState } from "react";
import {
  Circle,
  CircleDashed,
  Copy,
  Eraser,
  Move,
  PaintBucket,
  Pencil,
  PenTool,
  Plus,
  RotateCcw,
  RotateCw,
  Settings,
  Square,
  SquareDashed,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeLayer, isPixelEditableLayer } from "../domain/layers";
import { nextPatternPreviewHue, numberShortcutForSwatchRef } from "../domain/palette";
import { DEFAULT_PATTERN_SAMPLING, PATTERN_LIBRARY_SECTIONS, builtInPattern, type PatternDefinition } from "../domain/patterns";
import { toolUsesBrushSize } from "../domain/toolProperties";
import type {
  BrushShape,
  EditTarget,
  PaletteEntry,
  SwatchRef,
  PatternPaletteEntry,
  PatternRotation,
  PatternSamplingSettings,
  ProjectPalette,
  Tool,
} from "../domain/types";
import { EditorControlRow, EditorPanel, EditorPane, EditorPaneTitle } from "./layout/editor-layout";
import { PixelSwatch } from "./PixelSwatch";
import { PlaydateStreamMenu } from "./PlaydateStreamMenu";
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
  const activeSwatchRef = useEditorStore((state) => state.activeSwatchRef);
  const setActiveSwatchRef = useEditorStore((state) => state.setActiveSwatchRef);
  const addPatternSwatch = useEditorStore((state) => state.addPatternSwatch);
  const updatePatternSwatch = useEditorStore((state) => state.updatePatternSwatch);
  const duplicatePatternSwatch = useEditorStore((state) => state.duplicatePatternSwatch);
  const deletePatternSwatch = useEditorStore((state) => state.deletePatternSwatch);
  const brushSize = useEditorStore((state) => state.brushSize);
  const brushShape = useEditorStore((state) => state.brushShape);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const setBrushShape = useEditorStore((state) => state.setBrushShape);
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
      entries: palette.entries.filter((entry) => entry.type === "pattern"),
    },
  ].filter((group) => group.entries.length > 0);

  return (
    <EditorPanel side="left" className="flex flex-col" aria-label="Drawing tools">
      <ToolPropertiesPane
        activeTool={activeTool}
        brushShape={brushShape}
        brushSize={brushSize}
        propertiesEnabled={propertiesEnabled}
        setBrushShape={setBrushShape}
        setBrushSize={setBrushSize}
      />

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
        activeSwatchRef={activeSwatchRef}
        colorizedPatternsVisible={colorizedPatternsVisible}
        palette={palette}
        paletteEnabled={paletteEnabled}
        paletteGroups={paletteGroups}
        addPatternSwatch={addPatternSwatch}
        updatePatternSwatch={updatePatternSwatch}
        duplicatePatternSwatch={duplicatePatternSwatch}
        deletePatternSwatch={deletePatternSwatch}
        setActiveSwatchRef={setActiveSwatchRef}
      />
      <div className="mt-auto border-t border-border p-4">
        <PlaydateStreamMenu align="start" className="w-full justify-start" />
      </div>
    </EditorPanel>
  );
}

function SwatchesPane({
  activeSwatchRef,
  colorizedPatternsVisible,
  palette,
  paletteEnabled,
  paletteGroups,
  addPatternSwatch,
  updatePatternSwatch,
  duplicatePatternSwatch,
  deletePatternSwatch,
  setActiveSwatchRef,
}: {
  activeSwatchRef: SwatchRef;
  colorizedPatternsVisible: boolean;
  palette: ProjectPalette;
  paletteEnabled: boolean;
  paletteGroups: Array<{ id: string; label: string; entries: PaletteEntry[] }>;
  addPatternSwatch: (patternId: string, sampling?: PatternSamplingSettings) => void;
  updatePatternSwatch: (
    ref: SwatchRef,
    updates: Partial<
      Pick<PatternPaletteEntry, "offsetX" | "offsetY" | "patternId" | "reflectX" | "reflectY" | "rotation">
    >,
  ) => void;
  duplicatePatternSwatch: (ref: SwatchRef) => void;
  deletePatternSwatch: (ref: SwatchRef) => void;
  setActiveSwatchRef: (ref: PaletteEntry["ref"]) => void;
}): React.JSX.Element {
  const [editingRef, setEditingRef] = useState<SwatchRef | null | undefined>(undefined);
  const selectedPattern = palette.entries.find(
    (entry): entry is PatternPaletteEntry => entry.type === "pattern" && entry.ref === activeSwatchRef,
  );
  const editingEntry =
    editingRef === null
      ? null
      : palette.entries.find((entry): entry is PatternPaletteEntry => entry.type === "pattern" && entry.ref === editingRef) ?? null;

  return (
    <EditorPane disabled={!paletteEnabled}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <EditorPaneTitle>Swatches</EditorPaneTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" disabled={!paletteEnabled} onClick={() => setEditingRef(null)}>
              <span className="sr-only">Add pattern swatch</span>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add pattern swatch</TooltipContent>
        </Tooltip>
      </div>
      <div className="space-y-3">
        {paletteGroups.map((group, groupIndex) => (
          <div key={group.id} className="space-y-3">
            {groupIndex > 0 ? <Separator /> : null}
            <div className={ICON_GRID_CLASS} aria-label={group.label}>
              {group.entries.map((entry) => (
                <PaletteButton
                  key={entry.id}
                  active={activeSwatchRef === entry.ref}
                  colorizedPatterns={colorizedPatternsVisible}
                  disabled={!paletteEnabled}
                  entry={entry}
                  onSelect={setActiveSwatchRef}
                  palette={palette}
                  shortcut={numberShortcutForSwatchRef(palette, entry.ref)}
                />
              ))}
            </div>
          </div>
        ))}
        {selectedPattern ? (
          <div className="flex gap-2">
            <SwatchActionButton
              disabled={!paletteEnabled}
              icon={Settings}
              label="Edit selected pattern swatch"
              onClick={() => setEditingRef(selectedPattern.ref)}
            />
            <SwatchActionButton
              disabled={!paletteEnabled}
              icon={Copy}
              label="Duplicate selected pattern swatch"
              onClick={() => duplicatePatternSwatch(selectedPattern.ref)}
            />
            <SwatchActionButton
              disabled={!paletteEnabled}
              icon={Trash2}
              label="Delete selected pattern swatch"
              onClick={() => deletePatternSwatch(selectedPattern.ref)}
            />
          </div>
        ) : null}
      </div>
      {editingRef !== undefined ? (
        <PatternSwatchDialog
          entry={editingEntry}
          open
          palette={palette}
          onOpenChange={(open) => {
            if (!open) setEditingRef(undefined);
          }}
          onCreate={(patternId, sampling) => addPatternSwatch(patternId, sampling)}
          onUpdate={(ref, updates) => updatePatternSwatch(ref, updates)}
        />
      ) : null}
    </EditorPane>
  );
}

function ToolPropertiesPane({
  activeTool,
  brushShape,
  brushSize,
  propertiesEnabled,
  setBrushShape,
  setBrushSize,
}: {
  activeTool: Tool;
  brushShape: BrushShape;
  brushSize: number;
  propertiesEnabled: boolean;
  setBrushShape: (shape: BrushShape) => void;
  setBrushSize: (size: number) => void;
}): React.JSX.Element {
  const hasBrushSize = toolUsesBrushSize(activeTool);
  if (!hasBrushSize) return <></>;

  return (
    <EditorPane disabled={!propertiesEnabled}>
      <EditorPaneTitle className="mb-3">{toolLabel(activeTool)}</EditorPaneTitle>
      <EditorControlRow className="mb-3 grid-cols-[58px_minmax(0,1fr)]">
        <Label>Shape</Label>
        <div className="flex gap-2">
          <BrushShapeButton
            active={brushShape === "square"}
            disabled={!propertiesEnabled}
            label="Square brush"
            onSelect={() => setBrushShape("square")}
          >
            <Square />
          </BrushShapeButton>
          <BrushShapeButton
            active={brushShape === "circle"}
            disabled={!propertiesEnabled}
            label="Circle brush"
            onSelect={() => setBrushShape("circle")}
          >
            <Circle />
          </BrushShapeButton>
        </div>
      </EditorControlRow>
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
    </EditorPane>
  );
}

function BrushShapeButton({
  active,
  children,
  disabled,
  label,
  onSelect,
}: {
  active: boolean;
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <Button
      variant={active ? "secondary" : "outline"}
      size="icon"
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
    </Button>
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
  shortcut,
}: {
  active: boolean;
  colorizedPatterns: boolean;
  disabled: boolean;
  entry: PaletteEntry;
  onSelect: (ref: PaletteEntry["ref"]) => void;
  palette: ProjectPalette;
  shortcut: string | null;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="relative"
          variant={active ? "secondary" : "outline"}
          size="icon"
          aria-label={shortcut ? `${entry.name} paint, shortcut ${shortcut}` : `${entry.name} paint`}
          disabled={disabled}
          onClick={() => onSelect(entry.ref)}
        >
          <PixelSwatch
            className="size-7"
            colorizedPatterns={colorizedPatterns}
            palette={palette}
            sampleSize={13}
            swatchSize={26}
            value={entry.ref}
          />
          {shortcut ? (
            <span className="pointer-events-none absolute right-0 top-0 flex size-3.5 items-center justify-center rounded-[2px] border border-background bg-foreground text-[9px] leading-none text-background">
              {shortcut}
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{shortcut ? `${entry.name} (${shortcut})` : entry.name}</TooltipContent>
    </Tooltip>
  );
}

function SwatchActionButton({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="outline" aria-label={label} disabled={disabled} onClick={onClick}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PatternSwatchDialog({
  entry,
  onCreate,
  onOpenChange,
  onUpdate,
  open,
  palette,
}: {
  entry: PatternPaletteEntry | null;
  onCreate: (patternId: string, sampling: PatternSamplingSettings) => void;
  onOpenChange: (open: boolean) => void;
  onUpdate: (
    ref: SwatchRef,
    updates: Partial<
      Pick<PatternPaletteEntry, "offsetX" | "offsetY" | "patternId" | "reflectX" | "reflectY" | "rotation">
    >,
  ) => void;
  open: boolean;
  palette: ProjectPalette;
}): React.JSX.Element {
  const [patternId, setPatternId] = useState(entry?.patternId ?? "bayer-2x2-2");
  const [offsetX, setOffsetX] = useState(entry?.offsetX ?? DEFAULT_PATTERN_SAMPLING.offsetX);
  const [offsetY, setOffsetY] = useState(entry?.offsetY ?? DEFAULT_PATTERN_SAMPLING.offsetY);
  const [rotation, setRotation] = useState<PatternRotation>(entry?.rotation ?? DEFAULT_PATTERN_SAMPLING.rotation);
  const [reflectX, setReflectX] = useState(entry?.reflectX ?? DEFAULT_PATTERN_SAMPLING.reflectX);
  const [reflectY, setReflectY] = useState(entry?.reflectY ?? DEFAULT_PATTERN_SAMPLING.reflectY);
  const previewHue = entry?.previewHue ?? nextPatternPreviewHue(palette);

  const previewPalette = useMemo<ProjectPalette>(
    () => ({
      entries: [
        ...palette.entries.filter((candidate) => candidate.type === "solid"),
        {
          id: "preview-pattern",
          ref: 3,
          name: "Preview",
          type: "pattern",
          patternId,
          previewHue,
          offsetX,
          offsetY,
          rotation,
          reflectX,
          reflectY,
        },
      ],
    }),
    [offsetX, offsetY, palette.entries, patternId, previewHue, reflectX, reflectY, rotation],
  );

  const submit = () => {
    if (entry) {
      onUpdate(entry.ref, { offsetX, offsetY, patternId, reflectX, reflectY, rotation });
    } else {
      onCreate(patternId, { offsetX, offsetY, reflectX, reflectY, rotation });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Pattern Swatch" : "Add Pattern Swatch"}</DialogTitle>
          <DialogDescription>
            Choose a library pattern and adjust how this project swatch samples it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div
            className="max-h-[min(24rem,calc(100vh-21rem))] min-h-0 space-y-4 overflow-y-auto pb-3 pr-2"
            aria-label="Pattern library"
          >
            {PATTERN_LIBRARY_SECTIONS.map((section, sectionIndex) => {
              const patterns = section.patternIds.flatMap((sectionPatternId) => {
                const pattern = builtInPattern(sectionPatternId);
                return pattern ? [pattern] : [];
              });
              if (patterns.length === 0) return null;

              return (
                <section key={section.id} className={sectionIndex > 0 ? "border-t border-border pt-3" : undefined}>
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{section.title}</h3>
                  <div className="grid grid-cols-[repeat(auto-fill,2.75rem)] gap-2">
                    {patterns.map((pattern) => (
                      <PatternLibraryButton
                        key={pattern.id}
                        active={patternId === pattern.id}
                        palette={palette}
                        pattern={pattern}
                        onSelect={setPatternId}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="space-y-3">
            <div className="flex justify-center">
              <PixelSwatch
                className="size-24"
                colorizedPatterns
                palette={previewPalette}
                sampleSize={16}
                swatchSize={96}
                value={3}
              />
            </div>
            <RotationControl rotation={rotation} onChange={setRotation} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledNumberInput label="X" value={offsetX} onChange={setOffsetX} />
              <LabeledNumberInput label="Y" value={offsetY} onChange={setOffsetY} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reflectX} onChange={(event) => setReflectX(event.currentTarget.checked)} />
              Reflect X
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reflectY} onChange={(event) => setReflectY(event.currentTarget.checked)} />
              Reflect Y
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>{entry ? "Update" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatternLibraryButton({
  active,
  onSelect,
  palette,
  pattern,
}: {
  active: boolean;
  onSelect: (patternId: string) => void;
  palette: ProjectPalette;
  pattern: PatternDefinition;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={active ? "secondary" : "outline"}
          aria-label={pattern.name}
          onClick={() => onSelect(pattern.id)}
        >
          <PixelSwatch
            className="size-8"
            palette={{
              entries: [
                ...palette.entries.filter((candidate) => candidate.type === "solid"),
                {
                  id: pattern.id,
                  ref: 3,
                  name: pattern.name,
                  type: "pattern",
                  patternId: pattern.id,
                  previewHue: 300,
                  ...DEFAULT_PATTERN_SAMPLING,
                },
              ],
            }}
            sampleSize={12}
            swatchSize={30}
            value={3}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{pattern.name}</TooltipContent>
    </Tooltip>
  );
}

function RotationControl({
  onChange,
  rotation,
}: {
  onChange: (rotation: PatternRotation) => void;
  rotation: PatternRotation;
}): React.JSX.Element {
  const rotate = (direction: -1 | 1) => {
    const rotations: PatternRotation[] = [0, 90, 180, 270];
    const currentIndex = rotations.indexOf(rotation);
    const nextIndex = (currentIndex + direction + rotations.length) % rotations.length;
    onChange(rotations[nextIndex] ?? 0);
  };

  return (
    <div className="space-y-1">
      <Label>Rotation</Label>
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Rotate pattern left" onClick={() => rotate(-1)}>
          <RotateCcw />
        </Button>
        <div className="flex h-9 items-center justify-center px-2 text-sm font-medium tabular-nums text-muted-foreground">
          {rotation}°
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Rotate pattern right" onClick={() => rotate(1)}>
          <RotateCw />
        </Button>
      </div>
    </div>
  );
}

function LabeledNumberInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" step={1} value={value} onChange={(event) => onChange(Number(event.currentTarget.value) || 0)} />
    </div>
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
