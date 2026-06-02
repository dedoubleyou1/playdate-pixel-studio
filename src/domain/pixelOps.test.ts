import { describe, expect, it } from "vitest";
import { createLayer } from "./layers";
import { indexFor } from "./pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import { drawBrushAt, drawEllipse, drawInterpolatedStroke, drawLine, drawRect, floodFill } from "./pixelOps";

describe("pixel operations", () => {
  const pencilOptions = { shape: "square" as const, size: 1, mirrorX: false, mirrorY: false, swatchRef: BLACK_PIXEL };
  const eraserOptions = { shape: "square" as const, size: 1, mirrorX: false, mirrorY: false, swatchRef: TRANSPARENT_PIXEL };

  it("draws pencil, eraser, and swatch-ref brush pixels", () => {
    const layer = createLayer(1, "Layer 1");

    expect(drawBrushAt(layer, { x: 10, y: 10 }, pencilOptions)).toBe(true);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(BLACK_PIXEL);

    expect(drawBrushAt(layer, { x: 10, y: 10 }, eraserOptions)).toBe(true);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(TRANSPARENT_PIXEL);

    drawBrushAt(
      layer,
      { x: 12, y: 12 },
      {
        size: 2,
        shape: "square",
        mirrorX: false,
        mirrorY: false,
        swatchRef: 3,
      },
    );
    expect(layer.surface.data[indexFor(11, 11)]).toBe(3);
    expect(layer.surface.data[indexFor(12, 11)]).toBe(3);
  });

  it("draws explicit white paint", () => {
    const layer = createLayer(1, "Layer 1");

    expect(
      drawBrushAt(
        layer,
        { x: 10, y: 10 },
        {
          size: 1,
          shape: "square",
          mirrorX: false,
          mirrorY: false,
          swatchRef: WHITE_PIXEL,
        },
      ),
    ).toBe(true);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(WHITE_PIXEL);
  });

  it("draws lines, rectangle outlines, and ellipse outlines", () => {
    const layer = createLayer(1, "Layer 1");

    drawLine(layer, { x: 2, y: 3 }, { x: 5, y: 3 }, pencilOptions);
    expect(layer.surface.data[indexFor(2, 3)]).toBe(1);
    expect(layer.surface.data[indexFor(5, 3)]).toBe(1);

    drawRect(layer, { x: 8, y: 8 }, { x: 10, y: 10 }, pencilOptions);
    expect(layer.surface.data[indexFor(8, 8)]).toBe(1);
    expect(layer.surface.data[indexFor(9, 9)]).toBe(0);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(1);

    drawEllipse(layer, { x: 20, y: 20 }, { x: 24, y: 22 }, pencilOptions);
    expect(layer.surface.data[indexFor(20, 21)]).toBe(1);
    expect(layer.surface.data[indexFor(22, 20)]).toBe(1);
    expect(layer.surface.data[indexFor(22, 21)]).toBe(0);
    expect(layer.surface.data[indexFor(24, 21)]).toBe(1);
  });

  it("interpolates brush strokes between sampled pointer positions", () => {
    const layer = createLayer(1, "Layer 1");

    expect(drawInterpolatedStroke(layer, { x: 2, y: 4 }, { x: 6, y: 4 }, pencilOptions)).toBe(true);

    expect(layer.surface.data[indexFor(2, 4)]).toBe(1);
    expect(layer.surface.data[indexFor(3, 4)]).toBe(1);
    expect(layer.surface.data[indexFor(4, 4)]).toBe(1);
    expect(layer.surface.data[indexFor(5, 4)]).toBe(1);
    expect(layer.surface.data[indexFor(6, 4)]).toBe(1);
  });

  it("supports circle brush footprints", () => {
    const layer = createLayer(1, "Layer 1", 7, 7);

    drawBrushAt(layer, { x: 3, y: 3 }, { ...pencilOptions, shape: "circle", size: 3 });

    expect(layer.surface.data[indexFor(3, 3, 7)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(3, 2, 7)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(2, 3, 7)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(2, 2, 7)]).toBe(TRANSPARENT_PIXEL);
    expect(layer.surface.data[indexFor(4, 4, 7)]).toBe(TRANSPARENT_PIXEL);
  });

  it("flood fills enclosed regions", () => {
    const layer = createLayer(1, "Layer 1");
    drawRect(layer, { x: 1, y: 1 }, { x: 4, y: 4 }, pencilOptions);

    expect(floodFill(layer, { x: 2, y: 2 }, BLACK_PIXEL)).toBe(true);
    expect(layer.surface.data[indexFor(2, 2)]).toBe(1);
    expect(layer.surface.data[indexFor(0, 0)]).toBe(0);
  });

  it("flood fills with swatch refs", () => {
    const layer = createLayer(1, "Layer 1");

    expect(floodFill(layer, { x: 0, y: 0 }, 3)).toBe(true);

    expect(layer.surface.data[indexFor(0, 0)]).toBe(3);
    expect(layer.surface.data[indexFor(1, 0)]).toBe(3);
    expect(layer.surface.data[indexFor(1, 1)]).toBe(3);
  });
});
