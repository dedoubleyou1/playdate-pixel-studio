import { describe, expect, it } from "vitest";
import { PLAYDATE_WIDTH } from "../domain/constants";
import { createLayer, createSurface } from "../domain/layers";
import { indexFor } from "../domain/pixelOps";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import { TRANSPARENT_PREVIEW_SHADE, composeImageData, drawPixelSurfaceThumbnail } from "./compositor";

describe("composeImageData", () => {
  it("flattens visible layers into grayscale image data", () => {
    const bottom = createLayer(1, "Bottom");
    const top = createLayer(2, "Top");
    top.opacity = 50;
    bottom.surface.data[indexFor(1, 1)] = BLACK_PIXEL;
    top.surface.data[indexFor(2, 2)] = BLACK_PIXEL;

    const image = composeImageData([bottom, top], createImageData);
    expect(redAt(image, 1, 1)).toBe(0);
    expect(redAt(image, 2, 2)).toBe(128);
    expect(redAt(image, 3, 3)).toBe(255);
  });

  it("thresholds output for device previews", () => {
    const layer = createLayer(1, "Layer");
    layer.opacity = 50;
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

function pixelAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return Array.from(pixels.slice(offset, offset + 4));
}
