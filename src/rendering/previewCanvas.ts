import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import type { PixelLayer } from "../domain/types";
import { applyPreviewMode, type PreviewMode } from "../export/playdateExport";
import { composeImageData } from "./compositor";

export class PreviewCanvas {
  private readonly context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Preview canvas 2D context is unavailable.");
    }
    this.context = context;
  }

  render(layers: PixelLayer[], mode: PreviewMode = "normal"): void {
    const image = composeImageData(layers, (width, height) => this.context.createImageData(width, height), {
      device: true,
    });
    applyPreviewMode(image, mode);
    this.context.putImageData(image, 0, 0);
  }

  createExportCanvas(layers: PixelLayer[]): HTMLCanvasElement {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = PLAYDATE_WIDTH;
    exportCanvas.height = PLAYDATE_HEIGHT;
    const exportContext = exportCanvas.getContext("2d");
    if (!exportContext) {
      throw new Error("Export canvas 2D context is unavailable.");
    }
    exportContext.putImageData(
      composeImageData(layers, (width, height) => exportContext.createImageData(width, height), { device: true }),
      0,
      0,
    );
    return exportCanvas;
  }
}
