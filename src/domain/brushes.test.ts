import { describe, expect, it } from "vitest";
import { brushShapeContains } from "./brushes";

describe("brush shapes", () => {
  it("keeps square brushes filled", () => {
    expect(brushShapeContains("square", 3, 0, 0)).toBe(true);
    expect(brushShapeContains("square", 3, 2, 2)).toBe(true);
  });

  it("rounds circle brushes inside the brush footprint", () => {
    expect(brushShapeContains("circle", 3, 1, 1)).toBe(true);
    expect(brushShapeContains("circle", 3, 1, 0)).toBe(true);
    expect(brushShapeContains("circle", 3, 0, 0)).toBe(false);
    expect(brushShapeContains("circle", 4, 0, 0)).toBe(false);
    expect(brushShapeContains("circle", 4, 1, 1)).toBe(true);
  });
});
