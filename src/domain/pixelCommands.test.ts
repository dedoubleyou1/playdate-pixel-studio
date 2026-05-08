import { describe, expect, it } from "vitest";
import { createLayer } from "./layers";
import { indexFor } from "./pixelOps";
import {
  applyPixelToolDrag,
  applyPixelToolFinish,
  applyPixelToolStart,
  createShapePreview,
  paintSourceForTool,
  pixelCommandLabel,
  type PixelToolSettings,
} from "./pixelCommands";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";

const defaultSettings: PixelToolSettings = {
  brushSize: 1,
  mirrorX: false,
  mirrorY: false,
  paintValue: BLACK_PIXEL,
};

describe("pixel command helpers", () => {
  it("maps tools to command labels", () => {
    expect(pixelCommandLabel("pencil")).toBe("Draw stroke");
    expect(pixelCommandLabel("dither")).toBe("Draw stroke");
    expect(pixelCommandLabel("eraser")).toBe("Erase stroke");
    expect(pixelCommandLabel("fill")).toBe("Fill area");
    expect(pixelCommandLabel("line")).toBe("Draw line");
    expect(pixelCommandLabel("rect")).toBe("Draw rectangle");
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
        paintValue: WHITE_PIXEL,
      }).changed,
    ).toBe(true);
    expect(layer.surface.data[indexFor(2, 2)]).toBe(WHITE_PIXEL);

    expect(applyPixelToolStart(layer, { x: 2, y: 2 }, "eraser", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(2, 2)]).toBe(TRANSPARENT_PIXEL);
  });

  it("maps the legacy dither tool to checker pattern paint", () => {
    const paint = paintSourceForTool("dither", defaultSettings);

    expect(paint.type).toBe("pattern");
    expect(paint.pixelAt({ x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(paint.pixelAt({ x: 1, y: 0 })).toBe(TRANSPARENT_PIXEL);
  });

  it("fills from start and reports no-op fills", () => {
    const layer = createLayer(1, "Layer 1");

    expect(applyPixelToolStart(layer, { x: 0, y: 0 }, "fill", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(10, 10)]).toBe(BLACK_PIXEL);

    expect(applyPixelToolStart(layer, { x: 0, y: 0 }, "fill", defaultSettings).changed).toBe(false);
  });

  it("creates shape previews and applies shape finishes", () => {
    const layer = createLayer(1, "Layer 1");
    const preview = createShapePreview({ x: 1, y: 1 }, { x: 3, y: 1 }, "line", defaultSettings);

    expect(preview).toMatchObject({ type: "line", brushSize: 1, mirrorX: false, mirrorY: false });
    expect(createShapePreview({ x: 1, y: 1 }, { x: 3, y: 1 }, "pencil", defaultSettings)).toBeNull();

    expect(applyPixelToolFinish(layer, { x: 1, y: 1 }, { x: 3, y: 1 }, "line", defaultSettings).changed).toBe(true);
    expect(layer.surface.data[indexFor(1, 1)]).toBe(BLACK_PIXEL);
    expect(layer.surface.data[indexFor(3, 1)]).toBe(BLACK_PIXEL);
  });
});
