import { describe, expect, it } from "vitest";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { traceSelectionBoundaryPaths } from "./selectionEdges";

describe("traceSelectionBoundaryPaths", () => {
  it("traces one outside-offset loop for a single selected cell", () => {
    const mask = createBinaryMaskSurface(1, 1, true);

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(1);
    expect(pointStrings(paths[0].points)).toEqual(["0.5,0.5", "3.5,0.5", "3.5,3.5", "0.5,3.5"]);
  });

  it("simplifies rectangular selections to corner points", () => {
    const mask = createBinaryMaskSurface(2, 1, true);

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(1);
    expect(pointStrings(paths[0].points)).toEqual(["0.5,0.5", "5.5,0.5", "5.5,3.5", "0.5,3.5"]);
  });

  it("keeps a full-canvas selection visible in the overlay gutter", () => {
    const mask = createBinaryMaskSurface(2, 2, true);

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(1);
    expect(pointStrings(paths[0].points)).toEqual(["0.5,0.5", "5.5,0.5", "5.5,5.5", "0.5,5.5"]);
  });

  it("traces separate loops around holes", () => {
    const mask = createBinaryMaskSurface(3, 3, true);
    mask.data[indexFor(1, 1, 3)] = 0;

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.points.length).sort((a, b) => a - b)).toEqual([4, 4]);
  });

  it("traces disconnected islands as separate loops", () => {
    const mask = createBinaryMaskSurface(4, 1);
    mask.data[indexFor(0, 0, 4)] = 1;
    mask.data[indexFor(3, 0, 4)] = 1;

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(2);
    expect(paths.every((path) => path.points.length === 4)).toBe(true);
  });

  it("connects diagonally touching selections through the shared corner", () => {
    const mask = createBinaryMaskSurface(2, 2);
    mask.data[indexFor(0, 0, 2)] = 1;
    mask.data[indexFor(1, 1, 2)] = 1;

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(1);
    expect(paths[0].points).toHaveLength(8);
  });

  it("traces an 8-connected ring with a center hole as outer and inner paths", () => {
    const mask = createBinaryMaskSurface(3, 3);
    mask.data[indexFor(1, 0, 3)] = 1;
    mask.data[indexFor(0, 1, 3)] = 1;
    mask.data[indexFor(2, 1, 3)] = 1;
    mask.data[indexFor(1, 2, 3)] = 1;

    const paths = traceSelectionBoundaryPaths(mask, 2);

    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.points.length).sort((a, b) => a - b)).toEqual([4, 12]);
  });
});

function pointStrings(points: Array<{ x: number; y: number }>): string[] {
  return points.map((point) => `${point.x},${point.y}`);
}
