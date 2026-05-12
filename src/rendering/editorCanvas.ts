import { inBounds, mirroredPoints, walkEllipseOutline, walkLine, walkRectOutline } from "../domain/pixelGeometry";
import { brushShapeContains } from "../domain/brushes";
import { defaultProjectPalette } from "../domain/palette";
import type { CanvasToolPreview, EditTarget, Layer, ObjectDefinition, ProjectPalette } from "../domain/types";
import type { PixelValue } from "../domain/types";
import { composeImageData, TRANSPARENT_PREVIEW_SHADE } from "./compositor";
import type { LayerMovePreview, SelectionMovePreview } from "./frameComposer";

export class EditorCanvas {
  private readonly context: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly width: number,
    private readonly height: number,
  ) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Editor canvas 2D context is unavailable.");
    }
    this.context = context;
  }

  render({
    activeLayerIndex = 0,
    background,
    colorizedPatterns = false,
    editTarget = "pixels",
    layers,
    movePreview,
    objects,
    palette = defaultProjectPalette(),
    preview,
    selectionMovePreview,
  }: EditorCanvasRenderOptions): void {
    if (editTarget === "alphaMask") {
      this.renderAlphaMask(layers[activeLayerIndex], objects);
      if (preview) this.renderCanvasToolPreview(preview);
      return;
    }

    this.context.putImageData(
      composeImageData(layers, (width, height) => this.context.createImageData(width, height), {
        width: this.width,
        height: this.height,
        baseShade: TRANSPARENT_PREVIEW_SHADE,
        background,
        movePreview: movePreview ?? undefined,
        objects,
        palette,
        colorizedPatterns,
        selectionMovePreview: selectionMovePreview ?? undefined,
      }),
      0,
      0,
    );

    if (preview) {
      this.renderCanvasToolPreview(preview);
    }
  }

  pointerToPixel(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(this.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * this.width))),
      y: Math.max(0, Math.min(this.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * this.height))),
    };
  }

  setPointerCapture(pointerId: number): void {
    this.canvas.setPointerCapture(pointerId);
  }

  on<K extends keyof HTMLElementEventMap>(event: K, listener: (event: HTMLElementEventMap[K]) => void): void {
    this.canvas.addEventListener(event, listener);
  }

  private renderCanvasToolPreview(preview: CanvasToolPreview): void {
    this.context.save();
    this.context.fillStyle = "rgba(40, 87, 184, 0.78)";

    const plot = (x: number, y: number) => this.plotBrushPreview(x, y, preview);

    if (preview.type === "line") {
      walkLine(preview.start, preview.end, (point) => plot(point.x, point.y));
    } else if (preview.type === "rect") {
      walkRectOutline(preview.start, preview.end, (point) => plot(point.x, point.y));
    } else {
      walkEllipseOutline(preview.start, preview.end, (point) => plot(point.x, point.y));
    }

    this.context.restore();
  }

  private renderAlphaMask(layer: Layer | undefined, objects: ObjectDefinition[]): void {
    const image = this.context.createImageData(this.width, this.height);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = 255;
    }

    if (!layer) {
      this.context.putImageData(image, 0, 0);
      return;
    }

    const object = layer.type === "object" ? objects.find((candidate) => candidate.id === layer.objectId) : null;
    const mask = layer.alphaMask;
    const offsetX = layer.type === "object" ? layer.x : 0;
    const offsetY = layer.type === "object" ? layer.y : 0;
    const maskWidth = mask?.width ?? (layer.type === "pixel" ? layer.surface.width : (object?.width ?? 0));
    const maskHeight = mask?.height ?? (layer.type === "pixel" ? layer.surface.height : (object?.height ?? 0));

    for (let y = 0; y < maskHeight; y += 1) {
      const targetY = offsetY + y;
      if (targetY < 0 || targetY >= this.height) continue;
      for (let x = 0; x < maskWidth; x += 1) {
        const targetX = offsetX + x;
        if (targetX < 0 || targetX >= this.width) continue;
        const visible = mask ? mask.data[y * mask.width + x] === 1 : true;
        const value = visible ? 255 : 0;
        const pixelOffset = (targetY * this.width + targetX) * 4;
        image.data[pixelOffset] = value;
        image.data[pixelOffset + 1] = value;
        image.data[pixelOffset + 2] = value;
      }
    }

    this.context.putImageData(image, 0, 0);
  }

  private plotBrushPreview(x: number, y: number, preview: CanvasToolPreview): void {
    const half = Math.floor(preview.brushSize / 2);
    for (const point of mirroredPoints(x, y, preview.mirrorX, preview.mirrorY, this.width, this.height)) {
      for (let yy = 0; yy < preview.brushSize; yy += 1) {
        for (let xx = 0; xx < preview.brushSize; xx += 1) {
          if (!brushShapeContains(preview.brushShape, preview.brushSize, xx, yy)) continue;
          const px = point.x + xx - half;
          const py = point.y + yy - half;
          if (inBounds(px, py, this.width, this.height)) {
            this.context.fillRect(px, py, 1, 1);
          }
        }
      }
    }
  }
}

export interface EditorCanvasRenderOptions {
  activeLayerIndex?: number;
  background: PixelValue;
  colorizedPatterns?: boolean;
  editTarget?: EditTarget;
  layers: Layer[];
  movePreview?: LayerMovePreview | null;
  objects: ObjectDefinition[];
  palette?: ProjectPalette;
  preview: CanvasToolPreview | null;
  selectionMovePreview?: SelectionMovePreview | null;
}
