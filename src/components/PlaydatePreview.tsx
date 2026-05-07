import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import type { PreviewMode } from "../export/playdateExport";
import { PhysicalPreviewPanel } from "./PhysicalPreviewPanel";
import { PreviewCanvas } from "../rendering/previewCanvas";
import { useEditorStore } from "../state/editorStore";

const PREVIEW_MODES: Array<{ mode: PreviewMode; label: string }> = [
  { mode: "normal", label: "Normal" },
  { mode: "inverted", label: "Inverted" },
  { mode: "lcd", label: "LCD" },
];

export function PlaydatePreview(): React.JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layers = useEditorStore((state) => state.layers);
  const revision = useEditorStore((state) => state.revision);
  const previewOpen = useEditorStore((state) => state.previewOpen);
  const previewMode = useEditorStore((state) => state.previewMode);
  const setPreviewMode = useEditorStore((state) => state.setPreviewMode);
  const closePreview = useEditorStore((state) => state.closePreview);

  useEffect(() => {
    if (previewOpen && canvasRef.current) {
      new PreviewCanvas(canvasRef.current).render(layers, previewMode);
    }
  }, [layers, previewMode, previewOpen, revision]);

  return (
    <Dialog open={previewOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogContent className="preview-dialog p-0" aria-describedby="previewDescription">
        <div className="preview-header">
          <DialogHeader>
            <DialogTitle id="previewTitle">Playdate Preview</DialogTitle>
            <DialogDescription id="previewDescription">Flattened 1-bit screen output</DialogDescription>
          </DialogHeader>
          <div className="segmented-control" aria-label="Preview mode">
            {PREVIEW_MODES.map((item) => (
              <Button
                key={item.mode}
                variant={previewMode === item.mode ? "secondary" : "outline"}
                size="sm"
                onClick={() => setPreviewMode(item.mode)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="playdate-device">
          <div className="device-screen">
            <canvas id="previewCanvas" ref={canvasRef} width={PLAYDATE_WIDTH} height={PLAYDATE_HEIGHT} />
          </div>
          <div className="device-controls">
            <div className="dpad">
              <span />
            </div>
            <div className="menu-button" />
            <div className="ab-buttons">
              <span>A</span>
              <span>B</span>
            </div>
            <div className="crank" />
          </div>
        </div>
        <PhysicalPreviewPanel open={previewOpen} layers={layers} previewMode={previewMode} revision={revision} />
      </DialogContent>
    </Dialog>
  );
}
