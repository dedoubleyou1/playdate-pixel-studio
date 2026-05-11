import { memo, useEffect, useRef } from "react";
import { useDragDropMonitor } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Box, Copy, Eye, EyeOff, GripVertical, Minus, Plus, Shield, View, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { activeStack } from "../domain/layers";
import { projectPaletteKey } from "../domain/palette";
import { layerThumbnailKey, maskThumbnailKey } from "../domain/thumbnailKeys";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { BinaryMaskSurface, Layer, ObjectDefinition, PixelValue, ProjectPalette } from "../domain/types";
import { renderLayerThumbnail, renderMaskThumbnail } from "../rendering/compositor";
import {
  EditorList,
  EditorListItem,
  EditorPanel,
  EditorPane,
  EditorPaneTitle,
} from "./layout/editor-layout";
import { EditorAssetItem } from "./EditorAssetItem";
import { PixelSwatch } from "./PixelSwatch";
import { hasActiveSelection, useEditorStore } from "../state/editorStore";

export function LayersPanel(): React.JSX.Element {
  const stack = useEditorStore((state) => activeStack(state));
  const layers = stack.layers;
  const activeLayerIndex = stack.activeLayerIndex;
  const activeLayer = layers[activeLayerIndex];
  const objects = useEditorStore((state) => state.objects);
  const palette = useEditorStore((state) => state.palette);
  const addLayer = useEditorStore((state) => state.addLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const reorderLayer = useEditorStore((state) => state.reorderLayer);
  const setStackBackground = useEditorStore((state) => state.setStackBackground);
  const editTarget = useEditorStore((state) => state.editTarget);
  const addActiveLayerAlphaMask = useEditorStore((state) => state.addActiveLayerAlphaMask);
  const hasSelection = useEditorStore(hasActiveSelection);

  useDragDropMonitor({
    onDragEnd(event) {
      if (event.canceled) return;

      const { source } = event.operation;
      if (!isSortable(source)) return;
      if (source.initialIndex === source.index) return;

      reorderLayer(
        visualLayerIndexToStackIndex(layers.length, source.initialIndex),
        visualLayerIndexToStackIndex(layers.length, source.index),
      );
    },
  });

  return (
    <EditorPanel side="right" aria-label="Layers">
      <EditorPane>
        <div className="mb-3 flex items-center justify-between gap-3">
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
            <IconAction
              label={hasSelection ? "Add mask from selection" : "Add mask"}
              disabled={!activeLayer || Boolean(activeLayer.alphaMask)}
              onClick={addActiveLayerAlphaMask}
            >
              <View />
            </IconAction>
          </div>
        </div>
        <EditorList>
          {layers
            .map((layer, index) => ({ layer, index }))
            .reverse()
            .map(({ layer, index }, visualIndex) => (
              <div key={layer.id} className="grid gap-1">
                <LayerRow
                  layer={layer}
                  index={index}
                  visualIndex={visualIndex}
                  active={index === activeLayerIndex}
                  objects={objects}
                  palette={palette}
                />
                {layer.alphaMask ? (
                  <MaskRow
                    active={index === activeLayerIndex && editTarget === "alphaMask"}
                    index={index}
                    mask={layer.alphaMask}
                  />
                ) : null}
              </div>
            ))}
          <BackgroundRow background={stack.background} onChange={setStackBackground} />
        </EditorList>
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
      <Select value={String(background)} onValueChange={(value) => onChange(Number(value))}>
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
  visualIndex,
  active,
  objects,
  palette,
}: {
  layer: Layer;
  index: number;
  visualIndex: number;
  active: boolean;
  objects: ObjectDefinition[];
  palette: ProjectPalette;
}): React.JSX.Element {
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setEditTarget = useEditorStore((state) => state.setEditTarget);
  const renameLayer = useEditorStore((state) => state.renameLayer);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const thumbnailKey = `${layerThumbnailKey(layer, objects)}:${projectPaletteKey(palette)}`;
  const { handleRef, isDragging, ref: sortableRef } = useSortable({
    id: `layer:${layer.id}`,
    index: visualIndex,
    group: "layers",
    type: "layer",
    accept: "layer",
    data: {
      kind: "layer",
      layerId: layer.id,
      stackIndex: index,
    },
  });

  return (
    <EditorAssetItem
      active={active}
      ref={sortableRef}
      fallbackName={`Layer ${index + 1}`}
      className={cn("relative", isDragging && "opacity-50")}
      dragHandle={
        <button
          ref={handleRef}
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "cursor-grab text-muted-foreground active:cursor-grabbing",
          )}
          aria-label={`Reorder ${layer.name || `Layer ${index + 1}`}`}
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical />
        </button>
      }
      leadingIcon={layer.type === "object" ? <Box className="size-4 text-primary" aria-label="Object layer" /> : null}
      name={layer.name}
      nameLabel="Layer name"
      thumbnail={<LayerThumbnail layer={layer} objects={objects} palette={palette} thumbnailKey={thumbnailKey} />}
      onClick={() => {
        setActiveLayer(index);
        setEditTarget("pixels");
      }}
      onRename={(name) => renameLayer(index, name)}
      actions={
        <IconAction
          label={layer.visible ? "Hide layer" : "Show layer"}
          onClick={(event) => {
            event.stopPropagation();
            setLayerVisible(index, !layer.visible);
          }}
        >
          {layer.visible ? <Eye /> : <EyeOff />}
        </IconAction>
      }
    />
  );
}

function MaskRow({
  active,
  index,
  mask,
}: {
  active: boolean;
  index: number;
  mask: BinaryMaskSurface;
}): React.JSX.Element {
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setEditTarget = useEditorStore((state) => state.setEditTarget);
  const removeActiveLayerAlphaMask = useEditorStore((state) => state.removeActiveLayerAlphaMask);
  const thumbnailKey = maskThumbnailKey(mask);
  const selectMask = () => {
    setActiveLayer(index);
    setEditTarget("alphaMask");
  };

  return (
    <EditorListItem
      active={active}
      className="ml-9 grid-cols-[58px_minmax(0,1fr)_auto] min-h-11 cursor-default py-1.5"
      onClick={selectMask}
      aria-label={`Layer ${index + 1} alpha mask`}
    >
      <div className="asset-thumb-frame h-8">
        <MaskThumbnail mask={mask} thumbnailKey={thumbnailKey} />
      </div>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">Alpha Mask</span>
      </div>
      <IconAction
        label="Remove alpha mask"
        onClick={(event) => {
          event.stopPropagation();
          setActiveLayer(index);
          removeActiveLayerAlphaMask();
        }}
      >
        <X />
      </IconAction>
    </EditorListItem>
  );
}

function visualLayerIndexToStackIndex(layerCount: number, visualIndex: number): number {
  return layerCount - 1 - visualIndex;
}

const LayerThumbnail = memo(function LayerThumbnail({
  layer,
  objects,
  palette,
  thumbnailKey,
}: {
  layer: Layer;
  objects: ObjectDefinition[];
  palette: ProjectPalette;
  thumbnailKey: string;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (thumbnailRef.current) {
      renderLayerThumbnail(thumbnailRef.current, layer, objects, palette);
    }
  }, [layer, objects, palette, thumbnailKey]);

  return <canvas ref={thumbnailRef} className="layer-thumb" width={54} height={32} />;
}, areThumbnailPropsEqual);

const MaskThumbnail = memo(function MaskThumbnail({
  mask,
  thumbnailKey,
}: {
  mask: BinaryMaskSurface;
  thumbnailKey: string;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (thumbnailRef.current) {
      renderMaskThumbnail(thumbnailRef.current, mask);
    }
  }, [mask, thumbnailKey]);

  return <canvas ref={thumbnailRef} className="layer-thumb" width={54} height={32} />;
}, areThumbnailPropsEqual);

function areThumbnailPropsEqual(previous: { thumbnailKey: string }, next: { thumbnailKey: string }): boolean {
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
