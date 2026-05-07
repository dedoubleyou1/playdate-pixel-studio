import { useEffect, useRef } from "react";
import { Copy, Eye, EyeOff, Lock, Minus, Plus, RotateCcwSquare, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import type { PixelLayer } from "../domain/types";
import { renderLayerThumbnail } from "../rendering/compositor";
import { useEditorStore } from "../state/editorStore";

export function LayersPanel(): React.JSX.Element {
  const layers = useEditorStore((state) => state.layers);
  const activeLayerIndex = useEditorStore((state) => state.activeLayerIndex);
  const activeLayer = layers[activeLayerIndex];
  const revision = useEditorStore((state) => state.revision);
  const addLayer = useEditorStore((state) => state.addLayer);
  const duplicateLayer = useEditorStore((state) => state.duplicateLayer);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const setLayerOpacity = useEditorStore((state) => state.setLayerOpacity);
  const commitLayerOpacity = useEditorStore((state) => state.commitLayerOpacity);
  const clearActiveLayer = useEditorStore((state) => state.clearActiveLayer);
  const invertActiveLayer = useEditorStore((state) => state.invertActiveLayer);

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
              revision={revision}
            />
          ))}
      </div>
      <div className="panel-section">
        <div className="control-row">
          <Label>Opacity</Label>
          <Slider
            min={15}
            max={100}
            step={1}
            value={[activeLayer.opacity]}
            onValueChange={([value]) => setLayerOpacity(value ?? activeLayer.opacity)}
            onValueCommit={commitLayerOpacity}
          />
          <strong>{activeLayer.opacity}%</strong>
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
          <Button variant="outline" onClick={clearActiveLayer}>
            <Trash2 />
            Clear
          </Button>
          <Button variant="outline" onClick={invertActiveLayer}>
            <RotateCcwSquare />
            Invert
          </Button>
        </div>
      </div>
    </aside>
  );
}

function LayerRow({
  layer,
  index,
  active,
  revision,
}: {
  layer: PixelLayer;
  index: number;
  active: boolean;
  revision: number;
}): React.JSX.Element {
  const thumbnailRef = useRef<HTMLCanvasElement | null>(null);
  const setActiveLayer = useEditorStore((state) => state.setActiveLayer);
  const renameLayer = useEditorStore((state) => state.renameLayer);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const setLayerLocked = useEditorStore((state) => state.setLayerLocked);

  useEffect(() => {
    if (thumbnailRef.current) {
      renderLayerThumbnail(thumbnailRef.current, layer);
    }
  }, [layer, revision]);

  return (
    <div className={`layer-item${active ? " is-active" : ""}`} onClick={() => setActiveLayer(index)}>
      <canvas ref={thumbnailRef} className="layer-thumb" width={PLAYDATE_WIDTH} height={PLAYDATE_HEIGHT} />
      <input
        className="layer-name"
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
