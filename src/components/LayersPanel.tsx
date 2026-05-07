import { memo, useEffect, useRef } from "react";
import { Box, Copy, Eye, EyeOff, Minus, Plus, RotateCcwSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activeStack, isPixelEditableLayer } from "../domain/layers";
import { layerThumbnailKey } from "../domain/thumbnailKeys";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { Layer, ObjectDefinition, PixelValue } from "../domain/types";
import { renderLayerThumbnail } from "../rendering/compositor";
import {
  EditorControlRow,
  EditorList,
  EditorListItem,
  EditorPanel,
  EditorPane,
  EditorPaneHeader,
  EditorPaneTitle,
} from "./layout/editor-layout";
import { PixelSwatch } from "./PixelSwatch";
import { useEditorStore } from "../state/editorStore";

export function LayersPanel(): React.JSX.Element {
  const stack = useEditorStore((state) => activeStack(state));
  const layers = stack.layers;
  const activeLayerIndex = stack.activeLayerIndex;
  const activeLayer = layers[activeLayerIndex];
  const objects = useEditorStore((state) => state.objects);
  const addLayer = useEditorStore((state) => state.addLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const setLayerOpacity = useEditorStore((state) => state.setLayerOpacity);
  const commitLayerOpacity = useEditorStore((state) => state.commitLayerOpacity);
  const clearActiveLayer = useEditorStore((state) => state.clearActiveLayer);
  const invertActiveLayer = useEditorStore((state) => state.invertActiveLayer);
  const setStackBackground = useEditorStore((state) => state.setStackBackground);
  const activeLayerPixelEditable = isPixelEditableLayer(activeLayer);

  return (
    <EditorPanel side="right" aria-label="Layers">
      <EditorPaneHeader>
        <EditorPaneTitle>Layers</EditorPaneTitle>
        <div className="flex items-center gap-2">
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
      </EditorPaneHeader>
      <EditorList className="border-b border-border p-4">
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
            />
          ))}
        <BackgroundRow background={stack.background} onChange={setStackBackground} />
      </EditorList>
      <EditorPane>
        <EditorControlRow>
          <Label>Opacity</Label>
          <Slider
            min={15}
            max={100}
            step={1}
            value={[activeLayer?.opacity ?? 100]}
            onValueChange={([value]) => setLayerOpacity(value ?? activeLayer?.opacity ?? 100)}
            onValueCommit={commitLayerOpacity}
          />
          <strong className="text-right text-foreground">{activeLayer?.opacity ?? 100}%</strong>
        </EditorControlRow>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" disabled={activeLayerIndex >= layers.length - 1} onClick={() => moveLayer(1)}>
            Move Up
          </Button>
          <Button variant="outline" disabled={activeLayerIndex <= 0} onClick={() => moveLayer(-1)}>
            Move Down
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" disabled={!activeLayerPixelEditable} onClick={clearActiveLayer}>
            <Trash2 />
            Clear
          </Button>
          <Button variant="outline" disabled={!activeLayerPixelEditable} onClick={invertActiveLayer}>
            <RotateCcwSquare />
            Invert
          </Button>
        </div>
      </EditorPane>
    </EditorPanel>
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
    <EditorListItem className="grid-cols-[minmax(0,1fr)_auto] cursor-default" aria-label="Background">
      <strong className="min-w-0 text-sm">Background</strong>
      <Select value={String(background)} onValueChange={(value) => onChange(Number(value) as PixelValue)}>
        <SelectTrigger className="min-w-[132px]" aria-label="Background color">
          <SelectValue placeholder={getBackgroundShortLabel(selectedOption.label)} />
        </SelectTrigger>
        <SelectContent align="end">
          {BACKGROUND_VALUES.map((option) => (
            <SelectItem key={option.value} value={String(option.value)} textValue={option.label}>
              <PixelSwatch value={option.value} />
              <span>{getBackgroundShortLabel(option.label)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </EditorListItem>
  );
}

function getBackgroundShortLabel(label: string): string {
  return label.replace(" background", "");
}

function LayerRow({
  layer,
  index,
  active,
  objects,
}: {
  layer: Layer;
  index: number;
  active: boolean;
  objects: ObjectDefinition[];
}): React.JSX.Element {
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const renameLayer = useEditorStore((state) => state.renameLayer);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const thumbnailKey = layerThumbnailKey(layer, objects);

  return (
    <EditorListItem
      active={active}
      className={
        layer.type === "object"
          ? "grid-cols-[auto_auto_minmax(0,1fr)_auto]"
          : "grid-cols-[auto_minmax(0,1fr)_auto]"
      }
      onClick={() => setActiveLayer(index)}
    >
      <LayerThumbnail layer={layer} objects={objects} thumbnailKey={thumbnailKey} />
      {layer.type === "object" ? <Box className="size-4 text-primary" aria-label="Object layer" /> : null}
      <Input
        className="min-w-0"
        aria-label="Layer name"
        value={layer.name}
        onChange={(event) => renameLayer(index, event.target.value.trim() || `Layer ${index + 1}`)}
        onClick={(event) => event.stopPropagation()}
      />
      <IconAction
        label={layer.visible ? "Hide layer" : "Show layer"}
        onClick={(event) => {
          event.stopPropagation();
          setLayerVisible(index, !layer.visible);
        }}
      >
        {layer.visible ? <Eye /> : <EyeOff />}
      </IconAction>
    </EditorListItem>
  );
}

const LayerThumbnail = memo(function LayerThumbnail({
  layer,
  objects,
}: {
  layer: Layer;
  objects: ObjectDefinition[];
  thumbnailKey: string;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (thumbnailRef.current) {
      renderLayerThumbnail(thumbnailRef.current, layer, objects);
    }
  }, [layer, objects]);

  return <canvas ref={thumbnailRef} className="layer-thumb" width={54} height={32} />;
}, areThumbnailPropsEqual);

function areThumbnailPropsEqual(
  previous: { thumbnailKey: string },
  next: { thumbnailKey: string },
): boolean {
  return previous.thumbnailKey === next.thumbnailKey;
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
