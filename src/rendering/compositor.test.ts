import { describe, expect, it } from "vitest";
import { PLAYDATE_WIDTH } from "../domain/constants";
import { createLayer, createSurface } from "../domain/layers";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import { TRANSPARENT_PREVIEW_SHADE, composeImageData, drawMaskThumbnail, drawPixelSurfaceThumbnail } from "./compositor";
import { composeShades } from "./frameComposer";

describe("composeImageData", () => {
  it("flattens visible layers into grayscale image data", () => {
    const bottom = createLayer(1, "Bottom");
    const top = createLayer(2, "Top");
    bottom.surface.data[indexFor(1, 1)] = BLACK_PIXEL;
    top.surface.data[indexFor(2, 2)] = BLACK_PIXEL;

    const image = composeImageData([bottom, top], createImageData);
    expect(redAt(image, 1, 1)).toBe(0);
    expect(redAt(image, 2, 2)).toBe(0);
    expect(redAt(image, 3, 3)).toBe(255);
  });

  it("thresholds output for device previews", () => {
    const layer = createLayer(1, "Layer");
    layer.surface.data[indexFor(5, 5)] = BLACK_PIXEL;

    const image = composeImageData([layer], createImageData, { device: true });
    expect(redAt(image, 5, 5)).toBe(0);
  });

  it("composites explicit white paint over lower layers", () => {
    const bottom = createLayer(1, "Bottom");
    const top = createLayer(2, "Top");
    bottom.surface.data[indexFor(1, 1)] = BLACK_PIXEL;
    top.surface.data[indexFor(1, 1)] = WHITE_PIXEL;

    const image = composeImageData([bottom, top], createImageData);

    expect(redAt(image, 1, 1)).toBe(255);
  });

  it("can render transparent pixels as an explicit grey editor background", () => {
    const layer = createLayer(1, "Layer");
    const image = composeImageData([layer], createImageData, { baseShade: 192 });

    expect(redAt(image, 1, 1)).toBe(192);
  });

  it("uses stack background as the base composition color", () => {
    const layer = createLayer(1, "Layer");

    const black = composeImageData([layer], createImageData, { background: BLACK_PIXEL });
    const white = composeImageData([layer], createImageData, { background: WHITE_PIXEL });
    const transparent = composeImageData([layer], createImageData, {
      background: TRANSPARENT_PIXEL,
      baseShade: 192,
    });

    expect(redAt(black, 1, 1)).toBe(0);
    expect(redAt(white, 1, 1)).toBe(255);
    expect(redAt(transparent, 1, 1)).toBe(192);
  });

  it("resolves dither palette indexes at composition time", () => {
    const layer = createLayer(1, "Layer");
    layer.surface.data[indexFor(0, 0)] = 4;
    layer.surface.data[indexFor(1, 0)] = 4;
    layer.surface.data[indexFor(1, 1)] = 4;

    const image = composeImageData([layer], createImageData, { height: 2, width: 2 });

    expect(redAtWidth(image, 2, 0, 0)).toBe(0);
    expect(redAtWidth(image, 2, 1, 0)).toBe(255);
    expect(redAtWidth(image, 2, 1, 1)).toBe(0);
    expect(layer.surface.data[indexFor(1, 0)]).toBe(4);
  });

  it("can colorize dither patterns for editor previews without changing shade composition", () => {
    const layer = createLayer(1, "Layer");
    layer.surface.data[indexFor(0, 0)] = 3;
    layer.surface.data[indexFor(1, 0)] = 3;

    const normal = composeImageData([layer], createImageData, { height: 1, width: 2 });
    const colorized = composeImageData([layer], createImageData, {
      colorizedPatterns: true,
      height: 1,
      width: 2,
    });
    const shades = composeShades([layer], 2, 1);

    expect(pixelAt(colorized.data, 2, 0, 0)).toEqual([0, 64, 128, 255]);
    expect(pixelAt(colorized.data, 2, 1, 0)).toEqual([191, 223, 255, 255]);
    expect(pixelAt(normal.data, 2, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(normal.data, 2, 1, 0)).toEqual([255, 255, 255, 255]);
    expect(Array.from(shades)).toEqual([0, 255]);
  });

  it("renders layer move previews without moving source pixels", () => {
    const layer = createLayer(1, "Layer");
    layer.surface.data[indexFor(1, 1)] = BLACK_PIXEL;

    const image = composeImageData([layer], createImageData, {
      baseShade: 192,
      height: 4,
      movePreview: { layerIndex: 0, dx: 2, dy: 1 },
      width: 4,
    });

    expect(redAtWidth(image, 4, 1, 1)).toBe(192);
    expect(redAtWidth(image, 4, 3, 2)).toBe(0);
    expect(layer.surface.data[indexFor(1, 1)]).toBe(BLACK_PIXEL);
  });

  it("renders selection move previews without moving unselected pixels", () => {
    const layer = createLayer(1, "Layer", 4, 4);
    layer.surface.data[indexFor(1, 1, 4)] = BLACK_PIXEL;
    layer.surface.data[indexFor(2, 1, 4)] = BLACK_PIXEL;

    const mask = createBinaryMaskSurface(4, 4);
    mask.data[indexFor(1, 1, 4)] = 1;
    const floating = createSurface(4, 4);
    floating.data[indexFor(1, 1, 4)] = BLACK_PIXEL;

    const image = composeImageData([layer], createImageData, {
      baseShade: 192,
      height: 4,
      selectionMovePreview: { layerIndex: 0, dx: 2, dy: 0, mask, surface: floating },
      width: 4,
    });

    expect(redAtWidth(image, 4, 1, 1)).toBe(192);
    expect(redAtWidth(image, 4, 2, 1)).toBe(0);
    expect(redAtWidth(image, 4, 3, 1)).toBe(0);
    expect(layer.surface.data[indexFor(1, 1, 4)]).toBe(BLACK_PIXEL);
  });

  it("can render implicit full-layer move previews with translated alpha masks", () => {
    const layer = createLayer(1, "Layer", 4, 4);
    layer.surface.data[indexFor(1, 1, 4)] = BLACK_PIXEL;
    const mask = createBinaryMaskSurface(4, 4, true);
    const alphaMask = createBinaryMaskSurface(4, 4);
    alphaMask.data[indexFor(1, 1, 4)] = 1;

    const image = composeImageData([layer], createImageData, {
      baseShade: 192,
      height: 4,
      selectionMovePreview: { alphaMask, layerIndex: 0, dx: 2, dy: 0, mask, surface: layer.surface },
      width: 4,
    });

    expect(redAtWidth(image, 4, 1, 1)).toBe(192);
    expect(redAtWidth(image, 4, 3, 1)).toBe(0);
  });

  it("applies alpha masks before layer compositing", () => {
    const layer = createLayer(1, "Layer", 2, 1);
    layer.surface.data[indexFor(0, 0, 2)] = BLACK_PIXEL;
    layer.surface.data[indexFor(1, 0, 2)] = BLACK_PIXEL;
    layer.alphaMask = createBinaryMaskSurface(2, 1);
    layer.alphaMask.data[1] = 1;

    const image = composeImageData([layer], createImageData, { height: 1, width: 2 });
    const shades = composeShades([layer], 2, 1);

    expect(redAtWidth(image, 2, 0, 0)).toBe(255);
    expect(redAtWidth(image, 2, 1, 0)).toBe(0);
    expect(Array.from(shades)).toEqual([255, 0]);
  });
});

describe("drawPixelSurfaceThumbnail", () => {
  it("downsamples source regions into grayscale thumbnail pixels", () => {
    const surface = createSurface(4, 4);
    surface.data.set([
      BLACK_PIXEL,
      TRANSPARENT_PIXEL,
      BLACK_PIXEL,
      WHITE_PIXEL,
      TRANSPARENT_PIXEL,
      TRANSPARENT_PIXEL,
      BLACK_PIXEL,
      WHITE_PIXEL,
      WHITE_PIXEL,
      WHITE_PIXEL,
      TRANSPARENT_PIXEL,
      TRANSPARENT_PIXEL,
      WHITE_PIXEL,
      WHITE_PIXEL,
      TRANSPARENT_PIXEL,
      TRANSPARENT_PIXEL,
    ]);
    const pixels = new Uint8ClampedArray(2 * 2 * 4);

    drawPixelSurfaceThumbnail(surface, pixels, 2, 2);

    expect(pixelAt(pixels, 2, 0, 0)).toEqual([144, 144, 144, 255]);
    expect(pixelAt(pixels, 2, 1, 0)).toEqual([128, 128, 128, 255]);
    expect(pixelAt(pixels, 2, 0, 1)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(pixels, 2, 1, 1)).toEqual([192, 192, 192, 255]);
  });

  it("centers the downsampled layer while leaving letterbox pixels untouched", () => {
    const surface = createSurface(4, 2);
    surface.data.fill(BLACK_PIXEL);
    const pixels = new Uint8ClampedArray(4 * 4 * 4);

    drawPixelSurfaceThumbnail(surface, pixels, 4, 4);

    expect(pixelAt(pixels, 4, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(pixels, 4, 0, 1)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 4, 3, 2)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 4, 3, 3)).toEqual([0, 0, 0, 0]);
  });

  it("uses the transparent preview shade for fully transparent regions", () => {
    const surface = createSurface(2, 2);
    const pixels = new Uint8ClampedArray(1 * 1 * 4);

    drawPixelSurfaceThumbnail(surface, pixels, 1, 1);

    expect(pixelAt(pixels, 1, 0, 0)).toEqual([
      TRANSPARENT_PREVIEW_SHADE,
      TRANSPARENT_PREVIEW_SHADE,
      TRANSPARENT_PREVIEW_SHADE,
      255,
    ]);
  });
});

describe("drawMaskThumbnail", () => {
  it("renders visible mask cells as white and hidden cells as black", () => {
    const mask = createBinaryMaskSurface(2, 2);
    mask.data[0] = 1;
    mask.data[3] = 1;
    const pixels = new Uint8ClampedArray(2 * 2 * 4);

    drawMaskThumbnail(mask, pixels, 2, 2);

    expect(pixelAt(pixels, 2, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(pixels, 2, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 2, 0, 1)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 2, 1, 1)).toEqual([255, 255, 255, 255]);
  });

  it("downsamples non-Playdate mask sizes into stable grayscale previews", () => {
    const mask = createBinaryMaskSurface(4, 4);
    mask.data.set([
      1, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 1, 1,
      0, 0, 1, 0,
    ]);
    const pixels = new Uint8ClampedArray(2 * 2 * 4);

    drawMaskThumbnail(mask, pixels, 2, 2);

    expect(pixelAt(pixels, 2, 0, 0)).toEqual([191, 191, 191, 255]);
    expect(pixelAt(pixels, 2, 1, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 2, 0, 1)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 2, 1, 1)).toEqual([191, 191, 191, 255]);
  });
});

function createImageData(width: number, height: number): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    colorSpace: "srgb",
  };
}

function redAt(image: ImageData, x: number, y: number): number {
  return image.data[(y * PLAYDATE_WIDTH + x) * 4];
}

function redAtWidth(image: ImageData, width: number, x: number, y: number): number {
  return image.data[(y * width + x) * 4];
}

function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(pixels.slice(offset, offset + 4));
}
