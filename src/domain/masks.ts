import { indexFor, inBounds, walkFilledEllipseSpans } from "./pixelGeometry";
import {
  TRANSPARENT_PIXEL,
  type BinaryMaskSurface,
  type PixelLayer,
  type PixelSurface,
  type Point,
  type SelectionBounds,
  type SelectionState,
} from "./types";

export type MaskBounds = SelectionBounds;

export function createBinaryMaskSurface(width: number, height: number, fill = false): BinaryMaskSurface {
  const data = new Uint8Array(width * height);
  if (fill) data.fill(1);
  return { width, height, data };
}

export function cloneBinaryMaskSurface(mask: BinaryMaskSurface): BinaryMaskSurface {
  return {
    width: mask.width,
    height: mask.height,
    data: new Uint8Array(mask.data),
  };
}

export function normalizeBinaryMaskSurface(
  width: number,
  height: number,
  data?: Uint8Array,
): BinaryMaskSurface {
  const normalized = createBinaryMaskSurface(width, height);
  if (!data) return normalized;
  const length = Math.min(normalized.data.length, data.length);
  for (let index = 0; index < length; index += 1) {
    normalized.data[index] = data[index] ? 1 : 0;
  }
  return normalized;
}

export function resizeBinaryMaskSurface(mask: BinaryMaskSurface, width: number, height: number): BinaryMaskSurface {
  const resized = createBinaryMaskSurface(width, height);
  const copyWidth = Math.min(mask.width, width);
  const copyHeight = Math.min(mask.height, height);

  for (let y = 0; y < copyHeight; y += 1) {
    const sourceStart = y * mask.width;
    const targetStart = y * width;
    resized.data.set(mask.data.slice(sourceStart, sourceStart + copyWidth), targetStart);
  }

  return resized;
}

export function translateBinaryMaskSurface(mask: BinaryMaskSurface, dx: number, dy: number): BinaryMaskSurface {
  const translated = createBinaryMaskSurface(mask.width, mask.height);
  for (let y = 0; y < mask.height; y += 1) {
    const targetY = y + dy;
    if (targetY < 0 || targetY >= mask.height) continue;
    for (let x = 0; x < mask.width; x += 1) {
      const targetX = x + dx;
      if (targetX < 0 || targetX >= mask.width) continue;
      translated.data[indexFor(targetX, targetY, mask.width)] = mask.data[indexFor(x, y, mask.width)] ? 1 : 0;
    }
  }
  return translated;
}

export function invertBinaryMaskSurface(mask: BinaryMaskSurface): BinaryMaskSurface {
  const inverted = createBinaryMaskSurface(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index += 1) {
    inverted.data[index] = mask.data[index] ? 0 : 1;
  }
  return inverted;
}

export function createRectMask(width: number, height: number, start: Point, end: Point): BinaryMaskSurface {
  const mask = createBinaryMaskSurface(width, height);
  const left = Math.max(0, Math.min(start.x, end.x));
  const right = Math.min(width - 1, Math.max(start.x, end.x));
  const top = Math.max(0, Math.min(start.y, end.y));
  const bottom = Math.min(height - 1, Math.max(start.y, end.y));

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      mask.data[indexFor(x, y, width)] = 1;
    }
  }

  return mask;
}

export function createEllipseMask(width: number, height: number, start: Point, end: Point): BinaryMaskSurface {
  const left = Math.max(0, Math.min(start.x, end.x));
  const right = Math.min(width - 1, Math.max(start.x, end.x));
  const top = Math.max(0, Math.min(start.y, end.y));
  const bottom = Math.min(height - 1, Math.max(start.y, end.y));
  const mask = createBinaryMaskSurface(width, height);

  if (right <= left || bottom <= top) {
    return createRectMask(width, height, start, end);
  }

  walkFilledEllipseSpans({ x: left, y: top }, { x: right, y: bottom }, (span) => {
    if (span.y < 0 || span.y >= height) return;
    for (let x = span.left; x <= span.right; x += 1) {
      if (x < 0 || x >= width) continue;
      mask.data[indexFor(x, span.y, width)] = 1;
    }
  });

  return mask;
}

export function maskIsEmpty(mask: BinaryMaskSurface | null | undefined): boolean {
  return !mask || !mask.data.some(Boolean);
}

export function maskBounds(mask: BinaryMaskSurface): MaskBounds | null {
  let left = mask.width;
  let top = mask.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!mask.data[indexFor(x, y, mask.width)]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  return right >= left && bottom >= top ? { left, top, right, bottom } : null;
}

export function createSelectionStateFromMask(mask: BinaryMaskSurface): SelectionState {
  const bounds = maskBounds(mask);
  return {
    bounds,
    isEmpty: bounds === null,
    mask,
  };
}

export function cloneSelectionState(selection: SelectionState | null): SelectionState | null {
  if (!selection) return null;
  return createSelectionStateFromMask(cloneBinaryMaskSurface(selection.mask));
}

export function maskContains(mask: BinaryMaskSurface | null | undefined, x: number, y: number): boolean {
  if (!mask) return true;
  if (!inBounds(x, y, mask.width, mask.height)) return false;
  return mask.data[indexFor(x, y, mask.width)] === 1;
}

export function alphaMaskAllows(mask: BinaryMaskSurface | null | undefined, x: number, y: number): boolean {
  return maskContains(mask, x, y);
}

export function canvasSelectionToLayerMask(
  selection: BinaryMaskSurface,
  layerWidth: number,
  layerHeight: number,
  offset: Point = { x: 0, y: 0 },
): BinaryMaskSurface {
  const mask = createBinaryMaskSurface(layerWidth, layerHeight);
  for (let y = 0; y < layerHeight; y += 1) {
    const sourceY = y + offset.y;
    if (sourceY < 0 || sourceY >= selection.height) continue;
    for (let x = 0; x < layerWidth; x += 1) {
      const sourceX = x + offset.x;
      if (sourceX < 0 || sourceX >= selection.width) continue;
      mask.data[indexFor(x, y, layerWidth)] = selection.data[indexFor(sourceX, sourceY, selection.width)] ? 1 : 0;
    }
  }
  return mask;
}

export function liftSelectedPixels(
  layer: PixelLayer,
  selection: BinaryMaskSurface,
): { source: PixelLayer; floating: PixelSurface } {
  const sourceData = new Uint8Array(layer.surface.data);
  const floatingData = new Uint8Array(layer.surface.data.length);

  for (let y = 0; y < layer.surface.height; y += 1) {
    if (y >= selection.height) continue;
    for (let x = 0; x < layer.surface.width; x += 1) {
      if (x >= selection.width) continue;
      const index = indexFor(x, y, layer.surface.width);
      if (!selection.data[indexFor(x, y, selection.width)]) continue;
      floatingData[index] = layer.surface.data[index];
      sourceData[index] = TRANSPARENT_PIXEL;
    }
  }

  return {
    source: { ...layer, surface: { ...layer.surface, data: sourceData } },
    floating: { ...layer.surface, data: floatingData },
  };
}

export function pasteFloatingPixels(layer: PixelLayer, floating: PixelSurface, dx: number, dy: number): PixelLayer {
  const data = new Uint8Array(layer.surface.data);

  for (let y = 0; y < floating.height; y += 1) {
    const targetY = y + dy;
    if (targetY < 0 || targetY >= layer.surface.height) continue;
    for (let x = 0; x < floating.width; x += 1) {
      const targetX = x + dx;
      if (targetX < 0 || targetX >= layer.surface.width) continue;
      const pixel = floating.data[indexFor(x, y, floating.width)];
      if (pixel === TRANSPARENT_PIXEL) continue;
      data[indexFor(targetX, targetY, layer.surface.width)] = pixel;
    }
  }

  return {
    ...layer,
    surface: {
      ...layer.surface,
      data,
    },
  };
}
