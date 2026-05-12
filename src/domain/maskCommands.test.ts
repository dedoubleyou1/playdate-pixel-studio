import { describe, expect, it } from "vitest";
import { createBinaryMaskSurface } from "./masks";
import { indexFor } from "./pixelGeometry";
import { applyMaskToolStart, type MaskToolSettings } from "./maskCommands";

const defaultSettings: MaskToolSettings = {
  brushSize: 3,
  brushShape: "circle",
  mirrorX: false,
  mirrorY: false,
  value: 1,
};

describe("mask command helpers", () => {
  it("supports circle brush footprints", () => {
    const mask = createBinaryMaskSurface(7, 7);

    expect(applyMaskToolStart(mask, { x: 3, y: 3 }, "pencil", defaultSettings)).toBe(true);

    expect(mask.data[indexFor(3, 3, 7)]).toBe(1);
    expect(mask.data[indexFor(3, 2, 7)]).toBe(1);
    expect(mask.data[indexFor(2, 3, 7)]).toBe(1);
    expect(mask.data[indexFor(2, 2, 7)]).toBe(0);
    expect(mask.data[indexFor(4, 4, 7)]).toBe(0);
  });
});
