import { describe, expect, it } from "vitest";
import { createLayer } from "./layers";
import { createRectMask } from "./masks";
import { indexFor } from "./pixelGeometry";
import {
  applyPixelToolDrag,
  applyPixelToolFinish,
  applyPixelToolStart,
  createCanvasToolPreview,
  pixelCommandLabel,
  type PixelToolSettings,
} from "./pixelCommands";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";

const defaultSettings: PixelToolSettings = {
  brushSize: 1,
  mirrorX: false,
  mirrorY: false,
  paletteIndex: BLACK_PIXEL,
};

describe("pixel command helpers", () => {
  it("maps tools to command labels", () => {
    expect(pixelCommandLabel("pencil")).toBe("Draw stroke");
    expect(pixelCommandLabel("eraser")).toBe("Erase stroke");
    expect(pixelCommandLabel("fill")).toBe("Fill area");
    expect(pixelCommandLabel("line")).toBe("Draw line");
    expect(pixelCommandLabel("rect")).toBe("Draw rectangle");
    expect(pixelCommandLabel("ellipse")).toBe("Draw ellipse");
  });

  it("applies brush starts and interpolated drags", () => {
    const layer = createLayer(1, "Layer 1");

    expect(applyPixelToolStart(layer, { x: 1, y: 1 }, "pencil", defaultSettings).changed).toBe(true);
    expect(applyPixelToolDrag(layer, { x: 1, y: 1 }, { x: 4, y: 1 }, "pencil", defaultSettings).changed).toBe(true);

    expect(layer.surface.data[indexFor(1, 1)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(2, 1)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(3, 1)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(4, 1)]).toBe(BLACK_PIXEL);
  });

  it("uses white paint and transparent erasing through tool settings", () => {
    const layer = createLayer(1, "Layer 1");

    expect(
      applyPixelToolStart(layer, { x: 2, y: 2 }, "pencil", {
        ...defaultSettings,
        paletteIndex: WHITE_PIXEL,
      }).changed,
    ).toBe(true);
    expect(layer.surface.data[indexFor(2, 2)]).toBe(WHITE_PIXEL);

    expect(applyPixelToolStart(layer, { x: 2, y: 2 }, "eraser", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(2, 2)]).toBe(TRANSPARENT_PIXEL);
  });

  it("fills from start and reports no-op fills", () => {
    const layer = createLayer(1, "Layer 1");

    expect(applyPixelToolStart(layer, { x: 0, y: 0 }, "fill", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(BLACK_PIXEL);

    expect(applyPixelToolStart(layer, { x: 0, y: 0 }, "fill", defaultSettings).changed).toBe(false);
  });

  it("applies the active palette index to fill tools", () => {
    const layer = createLayer(1, "Layer 1");

    expect(
      applyPixelToolStart(layer, { x: 0, y: 0 }, "fill", {
        ...defaultSettings,
        paletteIndex: 3,
      }).changed,
    ).toBe(true);

    expect(layer.surface.data[indexFor(0, 0)]).toBe(3);
    expect(layer.surface.data[indexFor(1, 0)]).toBe(3);
    expect(layer.surface.data[indexFor(1, 1)]).toBe(3);
  });

  it("creates shape previews and applies shape finishes", () => {
    const layer = createLayer(1, "Layer 1");
    const preview = createCanvasToolPreview({ x: 1, y: 1 }, { x: 3, y: 1 }, "line", defaultSettings);

    expect(preview).toMatchObject({ type: "line", brushSize: 1, mirrorX: false, mirrorY: false });
    expect(createCanvasToolPreview({ x: 1, y: 1 }, { x: 3, y: 3 }, "ellipse", defaultSettings)).toMatchObject({
      type: "ellipse",
    });
    expect(createCanvasToolPreview({ x: 1, y: 1 }, { x: 3, y: 1 }, "pencil", defaultSettings)).toBeNull();

    expect(applyPixelToolFinish(layer, { x: 1, y: 1 }, { x: 3, y: 1 }, "line", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(1, 1)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(3, 1)]).toBe(BLACK_PIXEL);

    expect(applyPixelToolFinish(layer, { x: 8, y: 8 }, { x: 12, y: 10 }, "ellipse", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(8, 9)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(10, 9)]).toBe(TRANSPARENT_PIXEL);
  });

  it("constrains brush, fill, and shape tools to the active selection mask", () => {
    const layer = createLayer(1, "Layer 1", 5, 5);
    const selectionMask = createRectMask(5, 5, { x: 1, y: 1 }, { x: 3, y: 3 });
    const settings = { ...defaultSettings, selectionMask };

    expect(applyPixelToolStart(layer, { x: 0, y: 0 }, "pencil", settings).changed).toBe(false);
    expect(applyPixelToolStart(layer, { x: 1, y: 1 }, "pencil", settings).changed).toBe(true);
    expect(applyPixelToolFinish(layer, { x: 0, y: 0 }, { x: 4, y: 0 }, "line", settings).changed).toBe(false);
    expect(applyPixelToolStart(layer, { x: 2, y: 2 }, "fill", { ...settings, paletteIndex: WHITE_PIXEL }).changed).toBe(
      true,
    );

    expect(layer.surface.data[indexFor(0, 0, 5)]).toBe(TRANSPARENT_PIXEL);
    expect(layer.surface.data[indexFor(1, 1, 5)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(2, 2, 5)]).toBe(WHITE_PIXEL);
    expect(layer.surface.data[indexFor(3, 3, 5)]).toBe(WHITE_PIXEL);
    expect(layer.surface.data[indexFor(4, 4, 5)]).toBe(TRANSPARENT_PIXEL);
  });
});
