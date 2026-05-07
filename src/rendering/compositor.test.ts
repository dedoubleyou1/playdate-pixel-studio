import { describe, expect, it } from "vitest";
import { PLAYDATE_WIDTH } from "../domain/constants";
import { createLayer } from "../domain/layers";
import { indexFor } from "../domain/pixelOps";
import { composeImageData } from "./compositor";

describe("composeImageData", () => {
  it("flattens visible layers into grayscale image data", () => {
    const bottom = createLayer(1, "Bottom");
    const top = createLayer(2, "Top");
    top.opacity = 50;
    bottom.surface.data[indexFor(1, 1)] = 1;
    top.surface.data[indexFor(2, 2)] = 1;

    const image = composeImageData([bottom, top], createImageData);
    expect(redAt(image, 1, 1)).toBe(0);
    expect(redAt(image, 2, 2)).toBe(128);
    expect(redAt(image, 3, 3)).toBe(255);
  });

  it("thresholds output for device previews", () => {
    const layer = createLayer(1, "Layer");
    layer.opacity = 50;
    layer.surface.data[indexFor(5, 5)] = 1;

    const image = composeImageData([layer], createImageData, { device: true });
    expect(redAt(image, 5, 5)).toBe(0);
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
