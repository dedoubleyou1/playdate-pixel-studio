import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import { BLACK_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { Layer, ObjectDefinition, ObjectInstanceLayer, PixelSurface, PixelValue } from "../domain/types";
import { composeFrame } from "./frameComposer";
import type { ComposedFrame } from "./frameComposer";

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
    drawPixelSurfaceThumbnail(layer.surface, pixels, width, height);
  } else {
    drawObjectLayerThumbnail(layer, objects, pixels, width, height);
  }

  context.putImageData(image, 0, 0);
}

export function renderObjectThumbnail(canvas: HTMLCanvasElement, object: ObjectDefinition): void {
  const context = requireCanvasContext(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const image = context.createImageData(width, height);
  const pixels = image.data;
  const frame = composeFrame(object.layers, object.width, object.height, { background: object.background });

  drawFrameThumbnail(frame, object.width, object.height, pixels, width, height);

  context.putImageData(image, 0, 0);
}

export function drawPixelSurfaceThumbnail(
  surface: PixelSurface,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const sourceWidth = surface.width;
  const sourceHeight = surface.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const targetWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.floor(sourceHeight * scale));
  const offsetX = Math.floor((width - targetWidth) / 2);
  const offsetY = Math.floor((height - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceTop = y / scale;
    const sourceBottom = (y + 1) / scale;
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceLeft = x / scale;
      const sourceRight = (x + 1) / scale;
      const targetX = offsetX + x;
      const targetY = offsetY + y;
      const pixelOffset = (targetY * width + targetX) * 4;
      const value = sampleSurfaceRegion(surface, sourceLeft, sourceTop, sourceRight, sourceBottom);

      pixels[pixelOffset] = value;
      pixels[pixelOffset + 1] = value;
      pixels[pixelOffset + 2] = value;
      pixels[pixelOffset + 3] = 255;
    }
  }
}

function sampleSurfaceRegion(
  surface: PixelSurface,
  sourceLeft: number,
  sourceTop: number,
  sourceRight: number,
  sourceBottom: number,
): number {
  const minX = Math.max(0, Math.floor(sourceLeft));
  const minY = Math.max(0, Math.floor(sourceTop));
  const maxX = Math.min(surface.width, Math.ceil(sourceRight));
  const maxY = Math.min(surface.height, Math.ceil(sourceBottom));
  let weightedShade = 0;
  let totalArea = 0;

  for (let sourceY = minY; sourceY < maxY; sourceY += 1) {
    const overlapY = Math.min(sourceBottom, sourceY + 1) - Math.max(sourceTop, sourceY);
    if (overlapY <= 0) continue;
    for (let sourceX = minX; sourceX < maxX; sourceX += 1) {
      const overlapX = Math.min(sourceRight, sourceX + 1) - Math.max(sourceLeft, sourceX);
      if (overlapX <= 0) continue;

      const area = overlapX * overlapY;
      const pixel = surface.data[sourceY * surface.width + sourceX];
      weightedShade += pixelToThumbnailShade(pixel) * area;
      totalArea += area;
    }
  }

  return totalArea > 0 ? Math.round(weightedShade / totalArea) : TRANSPARENT_PREVIEW_SHADE;
}

function pixelToThumbnailShade(pixel: number): number {
  if (pixel === BLACK_PIXEL) return 0;
  if (pixel === WHITE_PIXEL) return 255;
  return TRANSPARENT_PREVIEW_SHADE;
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

  const frame = composeFrame(object.layers, object.width, object.height, { background: object.background, objects });
  drawFrameThumbnail(frame, object.width, object.height, pixels, width, height);
}

function drawFrameThumbnail(
  frame: ComposedFrame,
  sourceWidth: number,
  sourceHeight: number,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const targetWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.floor(sourceHeight * scale));
  const offsetX = Math.floor((width - targetWidth) / 2);
  const offsetY = Math.floor((height - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceTop = y / scale;
    const sourceBottom = (y + 1) / scale;
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceLeft = x / scale;
      const sourceRight = (x + 1) / scale;
      const targetX = offsetX + x;
      const targetY = offsetY + y;
      const pixelOffset = (targetY * width + targetX) * 4;
      const value = sampleFrameRegion(frame, sourceWidth, sourceHeight, sourceLeft, sourceTop, sourceRight, sourceBottom);

      pixels[pixelOffset] = value;
      pixels[pixelOffset + 1] = value;
      pixels[pixelOffset + 2] = value;
      pixels[pixelOffset + 3] = 255;
    }
  }
}

function sampleFrameRegion(
  frame: ComposedFrame,
  width: number,
  height: number,
  sourceLeft: number,
  sourceTop: number,
  sourceRight: number,
  sourceBottom: number,
): number {
  const minX = Math.max(0, Math.floor(sourceLeft));
  const minY = Math.max(0, Math.floor(sourceTop));
  const maxX = Math.min(width, Math.ceil(sourceRight));
  const maxY = Math.min(height, Math.ceil(sourceBottom));
  let weightedShade = 0;
  let totalArea = 0;

  for (let sourceY = minY; sourceY < maxY; sourceY += 1) {
    const overlapY = Math.min(sourceBottom, sourceY + 1) - Math.max(sourceTop, sourceY);
    if (overlapY <= 0) continue;
    for (let sourceX = minX; sourceX < maxX; sourceX += 1) {
      const overlapX = Math.min(sourceRight, sourceX + 1) - Math.max(sourceLeft, sourceX);
      if (overlapX <= 0) continue;

      const area = overlapX * overlapY;
      const index = sourceY * width + sourceX;
      weightedShade += (frame.coverage[index] ? frame.shades[index] : TRANSPARENT_PREVIEW_SHADE) * area;
      totalArea += area;
    }
  }

  return totalArea > 0 ? Math.round(weightedShade / totalArea) : TRANSPARENT_PREVIEW_SHADE;
}

function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable.");
  }
  return context;
}
