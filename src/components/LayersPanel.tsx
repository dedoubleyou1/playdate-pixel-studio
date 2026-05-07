import { useEffect, useRef } from "react";
import { Box, Copy, Eye, EyeOff, Lock, Minus, Plus, RotateCcwSquare, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeStack } from "../domain/layers";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { Layer, ObjectDefinition, PixelValue } from "../domain/types";
import { renderLayerThumbnail } from "../rendering/compositor";
import { useEditorStore } from "../state/editorStore";

export function LayersPanel(): React.JSX.Element {
  const stack = useEditorStore((state) => activeStack(state));
  const layers = stack.layers;
  const activeLayerIndex = stack.activeLayerIndex;
  const activeLayer = layers[activeLayerIndex];
  const objects = useEditorStore((state) => state.objects);
  const revision = useEditorStore((state) => state.revision);
  const addLayer = useEditorStore((state) => state.addLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const setLayerOpacity = useEditorStore((state) => state.setLayerOpacity);
  const commitLayerOpacity = useEditorStore((state) => state.commitLayerOpacity);
  const clearActiveLayer = useEditorStore((state) => state.clearActiveLayer);
  const invertActiveLayer = useEditorStore((state) => state.invertActiveLayer);
  const setStackBackground = useEditorStore((state) => state.setStackBackground);

  return (
    <aside className="layers-panel" aria-label="Layers">
      <div className="panel-header">
        <h2>Layers</h2>
        <div className="mini-actions">
          <IconAction label="Add layer" onClick={addLayer}>
            <Plus />
          </IconAction>
          <IconAction label="Duplicate layer" onClick={duplicateLayer}>
            <Copy />
          </IconAction>
          <IconAction label="Delete layer" disabled={layers.length <= 1} onClick={deleteLayer}>
            <Minus />
          </IconAction>
        </div>
      </div>
      <div className="layer-list">
        {layers
          .map((layer, index) => ({ layer, index }))
          .reverse()
          .map(({ layer, index }) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              index={index}
              active={index === activeLayerIndex}
              objects={objects}
              revision={revision}
            />
          ))}
        <BackgroundRow background={stack.background} onChange={setStackBackground} />
      </div>
      <div className="panel-section">
        <div className="control-row">
          <Label>Opacity</Label>
          <Slider
            min={15}
            max={100}
            step={1}
            value={[activeLayer?.opacity ?? 100]}
            onValueChange={([value]) => setLayerOpacity(value ?? activeLayer?.opacity ?? 100)}
            onValueCommit={commitLayerOpacity}
          />
          <strong>{activeLayer?.opacity ?? 100}%</strong>
        </div>
        <div className="layer-actions">
          <Button variant="outline" disabled={activeLayerIndex >= layers.length - 1} onClick={() => moveLayer(1)}>
            Move Up
          </Button>
          <Button variant="outline" disabled={activeLayerIndex <= 0} onClick={() => moveLayer(-1)}>
            Move Down
          </Button>
        </div>
        <div className="layer-actions">
          <Button variant="outline" disabled={activeLayer?.type === "object"} onClick={clearActiveLayer}>
            <Trash2 />
            Clear
          </Button>
          <Button variant="outline" disabled={activeLayer?.type === "object"} onClick={invertActiveLayer}>
            <RotateCcwSquare />
            Invert
          </Button>
        </div>
      </div>
    </aside>
  );
}

const BACKGROUND_VALUES: Array<{ label: string; value: PixelValue }> = [
  { label: "Transparent background", value: TRANSPARENT_PIXEL },
  { label: "White background", value: WHITE_PIXEL },
  { label: "Black background", value: BLACK_PIXEL },
];

function BackgroundRow({
  background,
  onChange,
}: {
  background: PixelValue;
  onChange: (background: PixelValue) => void;
}): React.JSX.Element {
  const selectedOption = BACKGROUND_VALUES.find((option) => option.value === background) ?? BACKGROUND_VALUES[0];

  return (
    <div className="layer-item background-item" aria-label="Background">
      <strong>Background</strong>
      <Select value={String(background)} onValueChange={(value) => onChange(Number(value) as PixelValue)}>
        <SelectTrigger className="background-select-trigger" aria-label="Background color">
          <span className="background-select-value">
            <BackgroundColorSwatch value={selectedOption.value} />
            <span>{getBackgroundShortLabel(selectedOption.label)}</span>
          </span>
        </SelectTrigger>
        <SelectContent align="end" className="background-select-content">
          {BACKGROUND_VALUES.map((option) => (
            <SelectItem key={option.value} value={String(option.value)} className="background-select-item">
              <BackgroundColorSwatch value={option.value} />
              <span>{getBackgroundShortLabel(option.label)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getBackgroundShortLabel(label: string): string {
  return label.replace(" background", "");
}

function BackgroundColorSwatch({ value }: { value: PixelValue }): React.JSX.Element {
  return <span className={`background-color-swatch background-color-swatch-${value}`} aria-hidden="true" />;
}

function LayerRow({
  layer,
  index,
  active,
  objects,
  revision,
}: {
  layer: Layer;
  index: number;
  active: boolean;
  objects: ObjectDefinition[];
  revision: number;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const renameLayer = useEditorStore((state) => state.renameLayer);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const setLayerLocked = useEditorStore((state) => state.setLayerLocked);

  useEffect(() => {
    if (thumbnailRef.current) {
      renderLayerThumbnail(thumbnailRef.current, layer, objects);
    }
  }, [layer, objects, revision]);

  return (
    <div className={`layer-item${active ? " is-active" : ""}`} onClick={() => setActiveLayer(index)}>
      <canvas ref={thumbnailRef} className="layer-thumb" width={64} height={40} />
      {layer.type === "object" ? <Box className="layer-object-icon" aria-label="Object layer" /> : null}
      <Input
        className="min-w-0"
        aria-label="Layer name"
        value={layer.name}
        onChange={(event) => renameLayer(index, event.target.value.trim() || `Layer ${index + 1}`)}
        onClick={(event) => event.stopPropagation()}
      />
      <IconAction
        className={`layer-toggle${layer.visible ? "" : " is-off"}`}
        label={layer.visible ? "Hide layer" : "Show layer"}
        onClick={(event) => {
          event.stopPropagation();
          setLayerVisible(index, !layer.visible);
        }}
      >
        {layer.visible ? <Eye /> : <EyeOff />}
      </IconAction>
      <IconAction
        className={`layer-toggle${layer.locked ? " is-locked" : ""}`}
        label={layer.locked ? "Unlock layer" : "Lock layer"}
        onClick={(event) => {
          event.stopPropagation();
          setLayerLocked(index, !layer.locked);
        }}
      >
        {layer.locked ? <Lock /> : <Unlock />}
      </IconAction>
    </div>
  );
}

function IconAction({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" className={className} aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
