import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { WHITE_PIXEL } from "../domain/types";
import type { Layer, ObjectDefinition, PixelValue } from "../domain/types";
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

  render(
    layers: Layer[],
    mode: PreviewMode = "normal",
    objects: ObjectDefinition[] = [],
    background: PixelValue = WHITE_PIXEL,
  ): void {
    const image = composeImageData(layers, (width, height) => this.context.createImageData(width, height), {
      device: true,
      width: PLAYDATE_WIDTH,
      height: PLAYDATE_HEIGHT,
      background,
      objects,
    });
    applyPreviewMode(image, mode);
    this.context.putImageData(image, 0, 0);
  }

  createExportCanvas(
    layers: Layer[],
    objects: ObjectDefinition[] = [],
    background: PixelValue = WHITE_PIXEL,
  ): HTMLCanvasElement {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = PLAYDATE_WIDTH;
    exportCanvas.height = PLAYDATE_HEIGHT;
    const exportContext = exportCanvas.getContext("2d");
    if (!exportContext) {
      throw new Error("Export canvas 2D context is unavailable.");
    }
    exportContext.putImageData(
      composeImageData(layers, (width, height) => exportContext.createImageData(width, height), {
        device: true,
        width: PLAYDATE_WIDTH,
        height: PLAYDATE_HEIGHT,
        background,
        objects,
      }),
      0,
      0,
    );
    return exportCanvas;
  }
}
