import { memo, useEffect, useRef } from "react";
import { useDragDropMonitor } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Box, Copy, Eye, EyeOff, GripVertical, Plus, Shield, Trash2, View, X } from "lucide-react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { PixelValue } from "../domain/types";
import { renderLayerThumbnail, renderMaskThumbnail } from "../rendering/compositor";
import {
  EditorList,
  EditorListItem,
  EditorPanel,
  EditorPane,
  EditorPaneTitle,
} from "./layout/editor-layout";
import { EditorAssetItem } from "./EditorAssetItem";
import { ObjectLibrary } from "./ObjectLibrary";
import {
  areLayerPanelModelsEqual,
  contextQualifiedLayerKey,
  selectLayerPanelModel,
  selectLayerThumbnailKey,
  selectMaskThumbnailKey,
  stackForContextKey,
  type LayerPanelLayerMeta,
  type PanelContextKey,
} from "./panelSelectors";
import { PixelSwatch } from "./PixelSwatch";
import { hasActiveSelection, useEditorStore } from "../state/editorStore";

export function LayersPanel(): React.JSX.Element {
  const panel = useStoreWithEqualityFn(useEditorStore, selectLayerPanelModel, areLayerPanelModelsEqual);
  const addLayer = useEditorStore((state) => state.addLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const reorderLayer = useEditorStore((state) => state.reorderLayer);
  const setStackBackground = useEditorStore((state) => state.setStackBackground);
  const addActiveLayerAlphaMask = useEditorStore((state) => state.addActiveLayerAlphaMask);
  const hasSelection = useEditorStore(hasActiveSelection);

  useDragDropMonitor({
    onDragEnd(event) {
      if (event.canceled) return;

      const { source } = event.operation;
      if (!isSortable(source)) return;
      if (source.initialIndex === source.index) return;

      reorderLayer(
        visualLayerIndexToStackIndex(panel.layerCount, source.initialIndex),
        visualLayerIndexToStackIndex(panel.layerCount, source.index),
      );
    },
  });

  return (
    <EditorPanel side="right" aria-label="Layers">
      <ObjectLibrary />
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
            <IconAction label="Delete layer" disabled={panel.layerCount <= 1} onClick={deleteLayer}>
              <Trash2 />
            </IconAction>
            <IconAction
              label={hasSelection ? "Add mask from selection" : "Add mask"}
              disabled={panel.layerCount === 0 || panel.activeLayerHasAlphaMask}
              onClick={addActiveLayerAlphaMask}
            >
              <View />
            </IconAction>
          </div>
        </div>
        <EditorList>
          {[...panel.layers]
            .reverse()
            .map((layer, visualIndex) => (
              <LayerGroup
                key={contextQualifiedLayerKey(layer.contextKey, layer.id)}
                layer={layer}
                visualIndex={visualIndex}
                active={layer.stackIndex === panel.activeLayerIndex}
                editTarget={panel.editTarget}
              />
            ))}
          <BackgroundRow background={panel.background} onChange={setStackBackground} />
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
  active,
  dragHandle,
}: {
  layer: LayerPanelLayerMeta;
  active: boolean;
  dragHandle: React.ReactNode;
}): React.JSX.Element {
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setEditTarget = useEditorStore((state) => state.setEditTarget);
  const renameLayer = useEditorStore((state) => state.renameLayer);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const selectLayer = () => {
    setActiveLayer(layer.stackIndex);
    setEditTarget("pixels");
  };

  return (
    <EditorAssetItem
      active={active}
      fallbackName={`Layer ${layer.stackIndex + 1}`}
      className="relative"
      dragHandle={dragHandle}
      leadingIcon={layer.type === "object" ? <Box className="size-4 text-primary" aria-label="Object layer" /> : null}
      name={layer.name}
      nameLabel="Layer name"
      thumbnail={<LayerThumbnail contextKey={layer.contextKey} layerId={layer.id} />}
      onClick={selectLayer}
      onRename={(name) => renameLayer(layer.stackIndex, name)}
      actions={
        <IconAction
          label={layer.visible ? "Hide layer" : "Show layer"}
          onClick={(event) => {
            event.stopPropagation();
            setLayerVisible(layer.stackIndex, !layer.visible);
          }}
        >
          {layer.visible ? <Eye /> : <EyeOff />}
        </IconAction>
      }
    />
  );
}

function LayerGroup({
  layer,
  visualIndex,
  active,
  editTarget,
}: {
  layer: LayerPanelLayerMeta;
  visualIndex: number;
  active: boolean;
  editTarget: "pixels" | "alphaMask";
}): React.JSX.Element {
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setEditTarget = useEditorStore((state) => state.setEditTarget);
  const { handleRef, isDragging, ref: sortableRef } = useSortable({
    id: contextQualifiedLayerKey(layer.contextKey, layer.id),
    index: visualIndex,
    group: "layers",
    type: "layer",
    accept: "layer",
    data: {
      kind: "layer",
      contextKey: layer.contextKey,
      layerId: layer.id,
      stackIndex: layer.stackIndex,
    },
  });
  const selectLayer = () => {
    setActiveLayer(layer.stackIndex);
    setEditTarget("pixels");
  };

  return (
    <div ref={sortableRef} className={cn("grid gap-1", isDragging && "opacity-50")}>
      <LayerRow
        layer={layer}
        active={active}
        dragHandle={
          <span
            ref={handleRef}
            className="flex h-9 w-4 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
            aria-label={`Reorder ${layer.name || `Layer ${layer.stackIndex + 1}`}`}
            onPointerDownCapture={selectLayer}
            onClick={(event) => {
              event.stopPropagation();
              selectLayer();
            }}
          >
            <GripVertical className="size-4" />
          </span>
        }
      />
      {layer.hasAlphaMask ? (
        <MaskRow
          active={active && editTarget === "alphaMask"}
          contextKey={layer.contextKey}
          layerId={layer.id}
          index={layer.stackIndex}
        />
      ) : null}
    </div>
  );
}

function MaskRow({
  active,
  contextKey,
  index,
  layerId,
}: {
  active: boolean;
  contextKey: PanelContextKey;
  index: number;
  layerId: number;
}): React.JSX.Element {
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const setEditTarget = useEditorStore((state) => state.setEditTarget);
  const removeActiveLayerAlphaMask = useEditorStore((state) => state.removeActiveLayerAlphaMask);
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
        <MaskThumbnail contextKey={contextKey} layerId={layerId} />
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
  contextKey,
  layerId,
}: {
  contextKey: PanelContextKey;
  layerId: number;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailKey = useStoreWithEqualityFn(useEditorStore, (state) =>
    selectLayerThumbnailKey(state, contextKey, layerId),
  );

  useEffect(() => {
    const state = useEditorStore.getState();
    const stack = stackForContextKey(state, contextKey);
    const layer = stack?.layers.find((candidate) => candidate.id === layerId);
    if (thumbnailRef.current && layer) {
      renderLayerThumbnail(thumbnailRef.current, layer, state.objects, state.palette);
    }
  }, [contextKey, layerId, thumbnailKey]);

  return <canvas ref={thumbnailRef} className="layer-thumb" width={54} height={32} />;
});

const MaskThumbnail = memo(function MaskThumbnail({
  contextKey,
  layerId,
}: {
  contextKey: PanelContextKey;
  layerId: number;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailKey = useStoreWithEqualityFn(useEditorStore, (state) =>
    selectMaskThumbnailKey(state, contextKey, layerId),
  );

  useEffect(() => {
    const state = useEditorStore.getState();
    const stack = stackForContextKey(state, contextKey);
    const mask = stack?.layers.find((candidate) => candidate.id === layerId)?.alphaMask;
    if (thumbnailRef.current && mask) {
      renderMaskThumbnail(thumbnailRef.current, mask);
    }
  }, [contextKey, layerId, thumbnailKey]);

  return <canvas ref={thumbnailRef} className="layer-thumb" width={54} height={32} />;
});

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
