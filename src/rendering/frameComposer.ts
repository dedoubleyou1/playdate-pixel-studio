import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types.ts";
import type { Layer, ObjectDefinition, ObjectInstanceLayer, PixelLayer, PixelValue } from "../domain/types.ts";

export interface ComposedFrame {
  coverage: Uint8ClampedArray;
  shades: Uint8ClampedArray;
}

interface ComposeFrameOptions {
  baseShade?: number;
  background?: PixelValue;
  objects?: ObjectDefinition[];
}

export function composeShades(
  layers: Layer[],
  width: number,
  height: number,
  objects: ObjectDefinition[] = [],
  background: PixelValue = TRANSPARENT_PIXEL,
): Uint8ClampedArray {
  return composeFrame(layers, width, height, { background, objects }).shades;
}

export function composeFrame(
  layers: Layer[],
  width: number,
  height: number,
  options: ComposeFrameOptions = {},
): ComposedFrame {
  const shades = new Uint8ClampedArray(width * height);
  const coverage = new Uint8ClampedArray(width * height);
  initializeBackground({ coverage, shades }, options.background ?? TRANSPARENT_PIXEL, options.baseShade ?? 255);

  for (const layer of layers) {
    if (!layer.visible) continue;
    if (layer.type === "pixel") {
      compositePixelLayer({ coverage, shades }, width, height, layer);
    } else {
      compositeObjectLayer({ coverage, shades }, width, height, layer, options.objects ?? []);
    }
  }

  return { coverage, shades };
}

function compositePixelLayer(frame: ComposedFrame, width: number, height: number, layer: PixelLayer): void {
  const alpha = Math.max(0, Math.min(1, layer.opacity / 100));
  if (alpha <= 0) return;
  const sourceWidth = layer.surface.width;
  const sourceHeight = layer.surface.height;

  for (let y = 0; y < Math.min(height, sourceHeight); y += 1) {
    for (let x = 0; x < Math.min(width, sourceWidth); x += 1) {
      const sourceIndex = y * sourceWidth + x;
      const pixel = layer.surface.data[sourceIndex];
      const sourceShade = pixelToShade(pixel);
      if (sourceShade === null) continue;
      const targetIndex = y * width + x;
      frame.shades[targetIndex] = compositeShade(frame.shades[targetIndex], sourceShade, alpha);
      frame.coverage[targetIndex] = 1;
    }
  }
}

function compositeObjectLayer(
  frame: ComposedFrame,
  width: number,
  height: number,
  layer: ObjectInstanceLayer,
  objects: ObjectDefinition[],
): void {
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  if (!object) return;

  const alpha = Math.max(0, Math.min(1, layer.opacity / 100));
  if (alpha <= 0) return;
  const objectFrame = composeFrame(object.layers, object.width, object.height, {
    background: object.background,
    objects,
  });

  for (let y = 0; y < object.height; y += 1) {
    const targetY = layer.y + y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < object.width; x += 1) {
      const targetX = layer.x + x;
      if (targetX < 0 || targetX >= width) continue;

      const sourceIndex = y * object.width + x;
      if (!objectFrame.coverage[sourceIndex]) continue;

      const targetIndex = targetY * width + targetX;
      frame.shades[targetIndex] = compositeShade(frame.shades[targetIndex], objectFrame.shades[sourceIndex], alpha);
      frame.coverage[targetIndex] = 1;
    }
  }
}

function pixelToShade(pixel: number): number | null {
  if (pixel === BLACK_PIXEL) return 0;
  if (pixel === WHITE_PIXEL) return 255;
  return null;
}

function compositeShade(targetShade: number, sourceShade: number, alpha: number): number {
  return Math.round(targetShade * (1 - alpha) + sourceShade * alpha);
}

function initializeBackground(frame: ComposedFrame, background: PixelValue, transparentShade: number): void {
  const backgroundShade = pixelToShade(background);
  frame.shades.fill(backgroundShade ?? transparentShade);
  if (backgroundShade !== null) {
    frame.coverage.fill(1);
  }
}
