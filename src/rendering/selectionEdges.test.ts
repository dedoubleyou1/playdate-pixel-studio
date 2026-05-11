import { describe, expect, it } from "vitest";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { checkerSelectionColorIndex, createSelectionHaloMask, exposedSelectionEdges } from "./selectionEdges";

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

describe("createSelectionHaloMask", () => {
  it("marks all side strips and corners around a single selected cell", () => {
    const mask = createBinaryMaskSurface(1, 1, true);
    const halo = createSelectionHaloMask(mask, 2);

    expect(halo.width).toBe(4);
    expect(halo.height).toBe(4);
    expect(haloPoints(halo)).toEqual(
      new Set(["1,0", "2,0", "0,1", "3,1", "0,2", "3,2", "1,3", "2,3", "0,0", "3,0", "3,3", "0,3"]),
    );
  });

  it("does not mark shared interior pixels between adjacent selected cells", () => {
    const mask = createBinaryMaskSurface(2, 1, true);
    const halo = createSelectionHaloMask(mask, 2);
    const points = haloPoints(halo);

    for (let y = 1; y <= 2; y += 1) {
      for (let x = 1; x <= 4; x += 1) {
        expect(points.has(`${x},${y}`)).toBe(false);
      }
    }
  });

  it("skips the shared corner pixels between diagonally adjacent selected cells", () => {
    const mask = createBinaryMaskSurface(2, 2);
    mask.data[indexFor(0, 0, 2)] = 1;
    mask.data[indexFor(1, 1, 2)] = 1;
    const halo = createSelectionHaloMask(mask, 2);
    const points = haloPoints(halo);

    expect(points.has("3,3")).toBe(false);
    expect(points.has("2,2")).toBe(false);
  });

  it("keeps a visible gutter halo when the whole canvas is selected", () => {
    const mask = createBinaryMaskSurface(2, 2, true);
    const halo = createSelectionHaloMask(mask, 2);
    const points = haloPoints(halo);

    expect(points.has("1,0")).toBe(true);
    expect(points.has("4,0")).toBe(true);
    expect(points.has("0,1")).toBe(true);
    expect(points.has("5,4")).toBe(true);
    expect(points.has("3,2")).toBe(false);
    expect(points.has("2,3")).toBe(false);
  });

  it("marks the inside halo around holes", () => {
    const mask = createBinaryMaskSurface(3, 3, true);
    mask.data[indexFor(1, 1, 3)] = 0;
    const halo = createSelectionHaloMask(mask, 2);
    const points = haloPoints(halo);

    expect(points.has("3,3")).toBe(true);
    expect(points.has("4,3")).toBe(true);
    expect(points.has("3,4")).toBe(true);
    expect(points.has("4,4")).toBe(true);
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

function haloPoints(halo: { width: number; height: number; data: Uint8Array }): Set<string> {
  const points = new Set<string>();
  for (let y = 0; y < halo.height; y += 1) {
    for (let x = 0; x < halo.width; x += 1) {
      if (halo.data[indexFor(x, y, halo.width)]) points.add(`${x},${y}`);
    }
  }
  return points;
}
