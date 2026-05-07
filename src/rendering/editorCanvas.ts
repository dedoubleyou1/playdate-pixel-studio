import { inBounds, mirroredPoints, walkLine } from "../domain/pixelOps";
import type { Layer, ObjectDefinition, ShapePreview } from "../domain/types";
import { composeImageData } from "./compositor";

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

  render(layers: Layer[], preview: ShapePreview | null, objects: ObjectDefinition[]): void {
    this.context.putImageData(
      composeImageData(layers, (width, height) => this.context.createImageData(width, height), {
        width: this.width,
        height: this.height,
        objects,
      }),
      0,
      0,
    );

    if (preview) {
      this.renderShapePreview(preview);
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

  private renderShapePreview(preview: ShapePreview): void {
    this.context.save();
    this.context.fillStyle = "rgba(40, 87, 184, 0.78)";
    const plot = (x: number, y: number) => this.plotBrushPreview(x, y, preview);

    if (preview.type === "line") {
      walkLine(preview.start, preview.end, (point) => plot(point.x, point.y));
    } else {
      const left = Math.min(preview.start.x, preview.end.x);
      const right = Math.max(preview.start.x, preview.end.x);
      const top = Math.min(preview.start.y, preview.end.y);
      const bottom = Math.max(preview.start.y, preview.end.y);

      for (let x = left; x <= right; x += 1) {
        plot(x, top);
        plot(x, bottom);
      }
      for (let y = top; y <= bottom; y += 1) {
        plot(left, y);
        plot(right, y);
      }
    }

    this.context.restore();
  }

  private plotBrushPreview(x: number, y: number, preview: ShapePreview): void {
    const half = Math.floor(preview.brushSize / 2);
    for (const point of mirroredPoints(x, y, preview.mirrorX, preview.mirrorY, this.width, this.height)) {
      for (let yy = 0; yy < preview.brushSize; yy += 1) {
        for (let xx = 0; xx < preview.brushSize; xx += 1) {
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
