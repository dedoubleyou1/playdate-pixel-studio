import { describe, expect, it } from "vitest";
import { PLAYDATE_WIDTH } from "./constants";
import { indexFor, mirroredPoints, walkEllipseOutline, walkLine, walkRectOutline } from "./pixelGeometry";

describe("pixel geometry", () => {
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

  it("walks line points inclusively", () => {
    const points: string[] = [];
    walkLine({ x: 1, y: 1 }, { x: 4, y: 2 }, (point) => points.push(`${point.x},${point.y}`));

    expect(points[0]).toBe("1,1");
    expect(points.at(-1)).toBe("4,2");
  });

  it("walks rectangle outlines without duplicate corners", () => {
    const points = new Set<string>();
    let count = 0;
    walkRectOutline({ x: 1, y: 1 }, { x: 3, y: 3 }, (point) => {
      points.add(`${point.x},${point.y}`);
      count += 1;
    });

    expect(count).toBe(points.size);
    expect(points).toEqual(new Set(["1,1", "2,1", "3,1", "1,3", "2,3", "3,3", "1,2", "3,2"]));
  });

  it("walks ellipse outlines symmetrically inside the drag rectangle", () => {
    const points = new Set<string>();
    walkEllipseOutline({ x: 2, y: 2 }, { x: 8, y: 6 }, (point) => points.add(`${point.x},${point.y}`));

    expect(points.has("2,4")).toBe(true);
    expect(points.has("8,4")).toBe(true);
    expect(points.has("5,2")).toBe(true);
    expect(points.has("5,6")).toBe(true);
    expect(points.has("5,4")).toBe(false);
  });
});
