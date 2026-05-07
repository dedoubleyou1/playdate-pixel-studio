import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { BLACK_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { Layer, ObjectDefinition, ObjectInstanceLayer, PixelLayer, PixelValue } from "../domain/types";
import { composeFrame } from "./frameComposer";

export const TRANSPARENT_PREVIEW_SHADE = 192;

export interface ComposeOptions {
  baseShade?: number;
  background?: PixelValue;
  device?: boolean;
  width?: number;
  height?: number;
  objects?: ObjectDefinition[];
}

export function composeImageData(
  layers: Layer[],
  createImageData: (width: number, height: number) => ImageData,
  options: ComposeOptions = {},
): ImageData {
  const width = options.width ?? PLAYDATE_WIDTH;
  const height = options.height ?? PLAYDATE_HEIGHT;
  const shades = composeFrame(layers, width, height, {
    baseShade: options.baseShade,
    background: options.background,
    objects: options.objects ?? [],
  }).shades;
  const image = createImageData(width, height);
  const pixels = image.data;

  for (let i = 0; i < shades.length; i += 1) {
    const output = options.device && shades[i] < 224 ? 0 : shades[i];
    const pixelOffset = i * 4;
    pixels[pixelOffset] = output;
    pixels[pixelOffset + 1] = output;
    pixels[pixelOffset + 2] = output;
    pixels[pixelOffset + 3] = 255;
  }

  return image;
}

export function renderLayerThumbnail(canvas: HTMLCanvasElement, layer: Layer, objects: ObjectDefinition[] = []): void {
  const context = requireCanvasContext(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const image = context.createImageData(width, height);
  const pixels = image.data;

  if (layer.type === "pixel") {
    drawPixelLayerThumbnail(layer, pixels, width, height);
  } else {
    drawObjectLayerThumbnail(layer, objects, pixels, width, height);
  }

  context.clearRect(0, 0, width, height);
  context.putImageData(image, 0, 0);
}

export function renderObjectThumbnail(canvas: HTMLCanvasElement, object: ObjectDefinition): void {
  const context = requireCanvasContext(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const image = context.createImageData(width, height);
  const pixels = image.data;
  const frame = composeFrame(object.layers, object.width, object.height, { background: object.background });

  for (let y = 0; y < Math.min(height, object.height); y += 1) {
    for (let x = 0; x < Math.min(width, object.width); x += 1) {
      const sourceIndex = y * object.width + x;
      const shade = frame.shades[sourceIndex];
      const pixelOffset = (y * width + x) * 4;
      pixels[pixelOffset] = shade;
      pixels[pixelOffset + 1] = shade;
      pixels[pixelOffset + 2] = shade;
      pixels[pixelOffset + 3] = frame.coverage[sourceIndex] ? 255 : 0;
    }
  }

  context.clearRect(0, 0, width, height);
  context.putImageData(image, 0, 0);
}

function drawPixelLayerThumbnail(layer: PixelLayer, pixels: Uint8ClampedArray, width: number, height: number): void {
  const sourceWidth = layer.surface.width;
  const sourceHeight = layer.surface.height;
  for (let y = 0; y < Math.min(height, sourceHeight); y += 1) {
    for (let x = 0; x < Math.min(width, sourceWidth); x += 1) {
      const sourceIndex = y * sourceWidth + x;
      const pixelOffset = (y * width + x) * 4;
      const pixel = layer.surface.data[sourceIndex];
      const value = pixel === BLACK_PIXEL ? 0 : pixel === WHITE_PIXEL ? 255 : TRANSPARENT_PREVIEW_SHADE;
      pixels[pixelOffset] = value;
      pixels[pixelOffset + 1] = value;
      pixels[pixelOffset + 2] = value;
      pixels[pixelOffset + 3] = pixel === BLACK_PIXEL || pixel === WHITE_PIXEL ? 255 : 0;
    }
  }
}

function drawObjectLayerThumbnail(
  layer: ObjectInstanceLayer,
  objects: ObjectDefinition[],
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  if (!object) return;

  const frame = composeFrame(object.layers, object.width, object.height, { objects });
  for (let y = 0; y < Math.min(height, object.height); y += 1) {
    for (let x = 0; x < Math.min(width, object.width); x += 1) {
      const sourceIndex = y * object.width + x;
      const shade = frame.shades[sourceIndex];
      const pixelOffset = (y * width + x) * 4;
      pixels[pixelOffset] = shade;
      pixels[pixelOffset + 1] = shade;
      pixels[pixelOffset + 2] = shade;
      pixels[pixelOffset + 3] = frame.coverage[sourceIndex] ? 255 : 0;
    }
  }
}

function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  return context;
}
