import { PLAYDATE_HEIGHT, PLAYDATE_PIXELS, PLAYDATE_WIDTH } from "../domain/constants";
import type { PixelLayer } from "../domain/types";

export interface ComposeOptions {
  device?: boolean;
}

export function composeImageData(
  layers: PixelLayer[],
  createImageData: (width: number, height: number) => ImageData,
  options: ComposeOptions = {},
): ImageData {
  const image = createImageData(PLAYDATE_WIDTH, PLAYDATE_HEIGHT);
  const pixels = image.data;

  for (let i = 0; i < PLAYDATE_PIXELS; i += 1) {
    let shade = 255;
    for (const layer of layers) {
      if (!layer.visible || layer.data[i] === 0) continue;
      const alpha = Math.max(0, Math.min(1, layer.opacity / 100));
      shade = Math.round(shade * (1 - alpha));
    }

    const output = options.device && shade < 224 ? 0 : shade;
    const pixelOffset = i * 4;
    pixels[pixelOffset] = output;
    pixels[pixelOffset + 1] = output;
    pixels[pixelOffset + 2] = output;
    pixels[pixelOffset + 3] = 255;
  }

  return image;
}

export function renderLayerThumbnail(canvas: HTMLCanvasElement, layer: PixelLayer): void {
  const context = requireCanvasContext(canvas);
  const image = context.createImageData(PLAYDATE_WIDTH, PLAYDATE_HEIGHT);
  const pixels = image.data;

  for (let i = 0; i < PLAYDATE_PIXELS; i += 1) {
    const pixelOffset = i * 4;
    const value = layer.data[i] ? 0 : 255;
    pixels[pixelOffset] = value;
    pixels[pixelOffset + 1] = value;
    pixels[pixelOffset + 2] = value;
    pixels[pixelOffset + 3] = layer.data[i] ? 255 : 0;
  }

  context.clearRect(0, 0, PLAYDATE_WIDTH, PLAYDATE_HEIGHT);
  context.putImageData(image, 0, 0);
}

function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  return context;
}
