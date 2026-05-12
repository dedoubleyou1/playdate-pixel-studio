import type { JSX } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { EditorBar, EditorBarCenter, EditorBarLeft, EditorBarRight } from "./layout/editor-layout";

interface StageFooterProps {
  cursorLabel: string;
  maxZoom: number;
  minZoom: number;
  setZoomFromSlider: (value: number | undefined) => void;
  zoom: number;
}

export function StageFooter({
  cursorLabel,
  maxZoom,
  minZoom,
  setZoomFromSlider,
  zoom,
}: StageFooterProps): JSX.Element {
  return (
    <EditorBar className="[grid-area:meta] h-(--stage-meta-height) min-h-(--stage-meta-height) border-t border-border border-b-0 max-[980px]:h-auto max-[980px]:grid-cols-1 max-[980px]:items-stretch max-[980px]:px-4 max-[980px]:py-3">
      <EditorBarLeft
        className="grid grid-cols-[auto_minmax(120px,1fr)_36px] items-center gap-3"
        aria-label="Canvas view controls"
      >
        <Label>Zoom</Label>
        <Slider
          min={minZoom}
          max={maxZoom}
          step={1}
          value={[zoom]}
          onValueChange={([value]) => setZoomFromSlider(value)}
        />
        <strong className="text-right text-xs">{zoom}x</strong>
      </EditorBarLeft>
      <EditorBarCenter aria-hidden="true" />
      <EditorBarRight className="min-w-[110px] text-right max-[980px]:justify-start max-[980px]:text-left">
        <span className="text-xs text-muted-foreground">{cursorLabel}</span>
      </EditorBarRight>
    </EditorBar>
  );
}
