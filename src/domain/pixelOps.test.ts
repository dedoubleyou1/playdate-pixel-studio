import { describe, expect, it } from "vitest";
import { PLAYDATE_WIDTH } from "./constants";
import { createLayer } from "./layers";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import {
  drawBrushAt,
  drawInterpolatedStroke,
  drawLine,
  drawRect,
  floodFill,
  indexFor,
  mirroredPoints,
} from "./pixelOps";

describe("pixel operations", () => {
  const pencilOptions = { size: 1, mirrorX: false, mirrorY: false, paletteIndex: BLACK_PIXEL };
  const eraserOptions = { size: 1, mirrorX: false, mirrorY: false, paletteIndex: TRANSPARENT_PIXEL };

  it("maps coordinates into the Playdate screen buffer", () => {
    expect(indexFor(0, 0)).toBe(0);
    expect(indexFor(2, 1)).toBe(PLAYDATE_WIDTH + 2);
  });

  it("deduplicates mirrored points at mirror intersections", () => {
    expect(mirroredPoints(0, 0, true, true)).toEqual([
      { x: 0, y: 0 },
      { x: 399, y: 0 },
      { x: 0, y: 239 },
      { x: 399, y: 239 },
    ]);
  });

  it("draws pencil, eraser, and palette-index brush pixels", () => {
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
        mirrorX: false,
        mirrorY: false,
        paletteIndex: 3,
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
          mirrorX: false,
          mirrorY: false,
          paletteIndex: WHITE_PIXEL,
        },
      ),
    ).toBe(true);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(WHITE_PIXEL);
  });

  it("draws lines and rectangle outlines", () => {
    const layer = createLayer(1, "Layer 1");

    drawLine(layer, { x: 2, y: 3 }, { x: 5, y: 3 }, pencilOptions);
    expect(layer.surface.data[indexFor(2, 3)]).toBe(1);
    expect(layer.surface.data[indexFor(5, 3)]).toBe(1);

    drawRect(layer, { x: 8, y: 8 }, { x: 10, y: 10 }, pencilOptions);
    expect(layer.surface.data[indexFor(8, 8)]).toBe(1);
    expect(layer.surface.data[indexFor(9, 9)]).toBe(0);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(1);
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

  it("flood fills enclosed regions", () => {
    const layer = createLayer(1, "Layer 1");
    drawRect(layer, { x: 1, y: 1 }, { x: 4, y: 4 }, pencilOptions);

    expect(floodFill(layer, { x: 2, y: 2 }, BLACK_PIXEL)).toBe(true);
    expect(layer.surface.data[indexFor(2, 2)]).toBe(1);
    expect(layer.surface.data[indexFor(0, 0)]).toBe(0);
  });

  it("flood fills with palette indexes", () => {
    const layer = createLayer(1, "Layer 1");

    expect(floodFill(layer, { x: 0, y: 0 }, 3)).toBe(true);

    expect(layer.surface.data[indexFor(0, 0)]).toBe(3);
    expect(layer.surface.data[indexFor(1, 0)]).toBe(3);
    expect(layer.surface.data[indexFor(1, 1)]).toBe(3);
  });
});
