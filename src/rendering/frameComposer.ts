import { alphaMaskAllows } from "../domain/masks.ts";
import { defaultProjectPalette, resolvePaletteEntry, resolvePaletteEntryPreviewColor } from "../domain/palette.ts";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types.ts";
import type {
  BinaryMaskSurface,
  Layer,
  ObjectDefinition,
  ObjectInstanceLayer,
  PixelLayer,
  PixelSurface,
  PixelValue,
  ProjectPalette,
} from "../domain/types.ts";

export interface ComposedFrame {
  coverage: Uint8ClampedArray;
  shades: Uint8ClampedArray;
}

export interface ComposedColorFrame {
  blue: Uint8ClampedArray;
  coverage: Uint8ClampedArray;
  green: Uint8ClampedArray;
  red: Uint8ClampedArray;
}

interface ComposeFrameOptions {
  baseShade?: number;
  background?: PixelValue;
  colorizedPatterns?: boolean;
  movePreview?: LayerMovePreview;
  objects?: ObjectDefinition[];
  palette?: ProjectPalette;
  selectionMovePreview?: SelectionMovePreview;
}

export interface LayerMovePreview {
  layerIndex: number;
  dx: number;
  dy: number;
}

export interface SelectionMovePreview {
  layerIndex: number;
  alphaMask?: BinaryMaskSurface | null;
  dx: number;
  dy: number;
  mask: BinaryMaskSurface;
  surface: PixelSurface;
}

export function composeShades(
  layers: Layer[],
  width: number,
  height: number,
  objects: ObjectDefinition[] = [],
  background: PixelValue = TRANSPARENT_PIXEL,
  palette: ProjectPalette = defaultProjectPalette(),
): Uint8ClampedArray {
  return composeFrame(layers, width, height, { background, objects, palette }).shades;
}

export function composeFrame(
  layers: Layer[],
  width: number,
  height: number,
  options: ComposeFrameOptions = {},
): ComposedFrame {
  const shades = new Uint8ClampedArray(width * height);
  const coverage = new Uint8ClampedArray(width * height);
  const palette = options.palette ?? defaultProjectPalette();
  initializeBackground(
    { coverage, shades },
    width,
    height,
    options.background ?? TRANSPARENT_PIXEL,
    options.baseShade ?? 255,
    palette,
  );

  for (const [index, layer] of layers.entries()) {
    if (!layer.visible) continue;
    const movePreview = options.movePreview?.layerIndex === index ? options.movePreview : null;
    if (layer.type === "pixel") {
      const selectionMovePreview =
        options.selectionMovePreview?.layerIndex === index ? options.selectionMovePreview : null;
      compositePixelLayer(
        { coverage, shades },
        width,
        height,
        layer,
        palette,
        selectionMovePreview?.mask ?? null,
        movePreview?.dx ?? 0,
        movePreview?.dy ?? 0,
      );
      if (selectionMovePreview) {
        compositePixelSurface(
          { coverage, shades },
          width,
          height,
          selectionMovePreview.surface,
          palette,
          selectionMovePreview.alphaMask ?? null,
          selectionMovePreview.dx,
          selectionMovePreview.dy,
        );
      }
    } else {
      compositeObjectLayer(
        { coverage, shades },
        width,
        height,
        layer,
        options.objects ?? [],
        palette,
        movePreview?.dx ?? 0,
        movePreview?.dy ?? 0,
      );
    }
  }

  return { coverage, shades };
}

export function composeColorFrame(
  layers: Layer[],
  width: number,
  height: number,
  options: ComposeFrameOptions = {},
): ComposedColorFrame {
  const red = new Uint8ClampedArray(width * height);
  const green = new Uint8ClampedArray(width * height);
  const blue = new Uint8ClampedArray(width * height);
  const coverage = new Uint8ClampedArray(width * height);
  const palette = options.palette ?? defaultProjectPalette();
  initializeColorBackground(
    { blue, coverage, green, red },
    width,
    height,
    options.background ?? TRANSPARENT_PIXEL,
    options.baseShade ?? 255,
    palette,
    Boolean(options.colorizedPatterns),
  );

  for (const [index, layer] of layers.entries()) {
    if (!layer.visible) continue;
    const movePreview = options.movePreview?.layerIndex === index ? options.movePreview : null;
    if (layer.type === "pixel") {
      const selectionMovePreview =
        options.selectionMovePreview?.layerIndex === index ? options.selectionMovePreview : null;
      compositeColorPixelLayer(
        { blue, coverage, green, red },
        width,
        height,
        layer,
        palette,
        Boolean(options.colorizedPatterns),
        selectionMovePreview?.mask ?? null,
        movePreview?.dx ?? 0,
        movePreview?.dy ?? 0,
      );
      if (selectionMovePreview) {
        compositeColorPixelSurface(
          { blue, coverage, green, red },
          width,
          height,
          selectionMovePreview.surface,
          palette,
          Boolean(options.colorizedPatterns),
          selectionMovePreview.alphaMask ?? null,
          selectionMovePreview.dx,
          selectionMovePreview.dy,
        );
      }
    } else {
      compositeColorObjectLayer(
        { blue, coverage, green, red },
        width,
        height,
        layer,
        options.objects ?? [],
        palette,
        Boolean(options.colorizedPatterns),
        movePreview?.dx ?? 0,
        movePreview?.dy ?? 0,
      );
    }
  }

  return { blue, coverage, green, red };
}

function compositePixelLayer(
  frame: ComposedFrame,
  width: number,
  height: number,
  layer: PixelLayer,
  palette: ProjectPalette,
  skipMask: BinaryMaskSurface | null = null,
  dx = 0,
  dy = 0,
): void {
  compositePixelSurface(frame, width, height, layer.surface, palette, layer.alphaMask, dx, dy, skipMask);
}

function compositePixelSurface(
  frame: ComposedFrame,
  width: number,
  height: number,
  surface: PixelSurface,
  palette: ProjectPalette,
  alphaMask: BinaryMaskSurface | null | undefined,
  dx = 0,
  dy = 0,
  skipMask: BinaryMaskSurface | null = null,
): void {
  const sourceWidth = surface.width;
  const sourceHeight = surface.height;

  for (let y = 0; y < sourceHeight; y += 1) {
    const targetY = y + dy;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const targetX = x + dx;
      if (targetX < 0 || targetX >= width) continue;
      if (!alphaMaskAllows(alphaMask, x, y) || (skipMask && alphaMaskAllows(skipMask, x, y))) continue;
      const sourceIndex = y * sourceWidth + x;
      const pixel = surface.data[sourceIndex];
      const sourceShade = pixelToShade(resolvePaletteEntry(palette, pixel, { x: targetX, y: targetY }));
      if (sourceShade === null) continue;
      const targetIndex = targetY * width + targetX;
      frame.shades[targetIndex] = sourceShade;
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
  palette: ProjectPalette,
  dx = 0,
  dy = 0,
): void {
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  if (!object) return;

  const objectFrame = composeFrame(object.layers, object.width, object.height, {
    background: object.background,
    objects,
    palette,
  });

  for (let y = 0; y < object.height; y += 1) {
    const targetY = layer.y + dy + y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < object.width; x += 1) {
      const targetX = layer.x + dx + x;
      if (targetX < 0 || targetX >= width) continue;

      const sourceIndex = y * object.width + x;
      if (!objectFrame.coverage[sourceIndex]) continue;
      if (!alphaMaskAllows(layer.alphaMask, x, y)) continue;

      const targetIndex = targetY * width + targetX;
      frame.shades[targetIndex] = objectFrame.shades[sourceIndex];
      frame.coverage[targetIndex] = 1;
    }
  }
}

function compositeColorPixelLayer(
  frame: ComposedColorFrame,
  width: number,
  height: number,
  layer: PixelLayer,
  palette: ProjectPalette,
  colorizedPatterns: boolean,
  skipMask: BinaryMaskSurface | null = null,
  dx = 0,
  dy = 0,
): void {
  compositeColorPixelSurface(
    frame,
    width,
    height,
    layer.surface,
    palette,
    colorizedPatterns,
    layer.alphaMask,
    dx,
    dy,
    skipMask,
  );
}

function compositeColorPixelSurface(
  frame: ComposedColorFrame,
  width: number,
  height: number,
  surface: PixelSurface,
  palette: ProjectPalette,
  colorizedPatterns: boolean,
  alphaMask: BinaryMaskSurface | null | undefined,
  dx = 0,
  dy = 0,
  skipMask: BinaryMaskSurface | null = null,
): void {
  const sourceWidth = surface.width;
  const sourceHeight = surface.height;

  for (let y = 0; y < sourceHeight; y += 1) {
    const targetY = y + dy;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const targetX = x + dx;
      if (targetX < 0 || targetX >= width) continue;
      if (!alphaMaskAllows(alphaMask, x, y) || (skipMask && alphaMaskAllows(skipMask, x, y))) continue;
      const sourceIndex = y * sourceWidth + x;
      const pixel = surface.data[sourceIndex];
      const sourceColor = resolvePaletteEntryPreviewColor(palette, pixel, { x: targetX, y: targetY }, { colorizedPatterns });
      if (!sourceColor) continue;
      const targetIndex = targetY * width + targetX;
      compositeColorAt(frame, targetIndex, sourceColor.r, sourceColor.g, sourceColor.b);
    }
  }
}

function compositeColorObjectLayer(
  frame: ComposedColorFrame,
  width: number,
  height: number,
  layer: ObjectInstanceLayer,
  objects: ObjectDefinition[],
  palette: ProjectPalette,
  colorizedPatterns: boolean,
  dx = 0,
  dy = 0,
): void {
  const object = objects.find((candidate) => candidate.id === layer.objectId);
  if (!object) return;

  const objectFrame = composeColorFrame(object.layers, object.width, object.height, {
    background: object.background,
    colorizedPatterns,
    objects,
    palette,
  });

  for (let y = 0; y < object.height; y += 1) {
    const targetY = layer.y + dy + y;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < object.width; x += 1) {
      const targetX = layer.x + dx + x;
      if (targetX < 0 || targetX >= width) continue;

      const sourceIndex = y * object.width + x;
      if (!objectFrame.coverage[sourceIndex]) continue;
      if (!alphaMaskAllows(layer.alphaMask, x, y)) continue;

      const targetIndex = targetY * width + targetX;
      compositeColorAt(
        frame,
        targetIndex,
        objectFrame.red[sourceIndex],
        objectFrame.green[sourceIndex],
        objectFrame.blue[sourceIndex],
      );
    }
  }
}

function pixelToShade(pixel: number): number | null {
  if (pixel === BLACK_PIXEL) return 0;
  if (pixel === WHITE_PIXEL) return 255;
  return null;
}

function compositeColorAt(
  frame: ComposedColorFrame,
  index: number,
  red: number,
  green: number,
  blue: number,
): void {
  frame.red[index] = red;
  frame.green[index] = green;
  frame.blue[index] = blue;
  frame.coverage[index] = 1;
}

function initializeBackground(
  frame: ComposedFrame,
  width: number,
  height: number,
  background: PixelValue,
  transparentShade: number,
  palette: ProjectPalette,
): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const backgroundShade = pixelToShade(resolvePaletteEntry(palette, background, { x, y }));
      const index = y * width + x;
      frame.shades[index] = backgroundShade ?? transparentShade;
      if (backgroundShade !== null) {
        frame.coverage[index] = 1;
      }
    }
  }
}

function initializeColorBackground(
  frame: ComposedColorFrame,
  width: number,
  height: number,
  background: PixelValue,
  transparentShade: number,
  palette: ProjectPalette,
  colorizedPatterns: boolean,
): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const backgroundColor = resolvePaletteEntryPreviewColor(palette, background, { x, y }, { colorizedPatterns });
      const index = y * width + x;
      frame.red[index] = backgroundColor?.r ?? transparentShade;
      frame.green[index] = backgroundColor?.g ?? transparentShade;
      frame.blue[index] = backgroundColor?.b ?? transparentShade;
      if (backgroundColor) {
        frame.coverage[index] = 1;
      }
    }
  }
}
