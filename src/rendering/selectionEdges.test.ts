import { describe, expect, it } from "vitest";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { checkerSelectionColorIndex, exposedSelectionEdges } from "./selectionEdges";

describe("exposedSelectionEdges", () => {
  it("emits outer edges for adjacent selected cells without shared interior edges", () => {
    const mask = createBinaryMaskSurface(3, 3);
    mask.data[indexFor(0, 0, 3)] = 1;
    mask.data[indexFor(1, 0, 3)] = 1;

    expect(exposedSelectionEdges(mask)).toEqual([
      { side: "top", x: 0, y: 0 },
      { side: "bottom", x: 0, y: 0 },
      { side: "left", x: 0, y: 0 },
      { side: "top", x: 1, y: 0 },
      { side: "right", x: 1, y: 0 },
      { side: "bottom", x: 1, y: 0 },
    ]);
  });

  it("emits inner edges around holes", () => {
    const mask = createBinaryMaskSurface(3, 3, true);
    mask.data[indexFor(1, 1, 3)] = 0;

    expect(exposedSelectionEdges(mask)).toEqual(
      expect.arrayContaining([
        { side: "bottom", x: 1, y: 0 },
        { side: "right", x: 0, y: 1 },
        { side: "left", x: 2, y: 1 },
        { side: "top", x: 1, y: 2 },
      ]),
    );
  });
});

describe("checkerSelectionColorIndex", () => {
  it("alternates in screenspace cells and inverts by phase", () => {
    expect(checkerSelectionColorIndex(0, 0, 4, 0)).toBe(0);
    expect(checkerSelectionColorIndex(3, 3, 4, 0)).toBe(0);
    expect(checkerSelectionColorIndex(4, 0, 4, 0)).toBe(1);
    expect(checkerSelectionColorIndex(0, 4, 4, 0)).toBe(1);
    expect(checkerSelectionColorIndex(0, 0, 4, 1)).toBe(1);
  });
});
