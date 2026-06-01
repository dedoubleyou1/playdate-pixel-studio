import { describe, expect, it } from "vitest";
import { BUILT_IN_PATTERNS, PATTERN_LIBRARY_SECTIONS, builtInPattern, transformPatternPoint } from "./patterns";

describe("pattern library", () => {
  it("exposes a complete 2x2 Bayer ramp", () => {
    const section = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "bayer-2x2");

    expect(section?.title).toBe("2x2 Bayer");
    expect(section?.patternIds).toEqual(["bayer-2x2-1", "bayer-2x2-2", "bayer-2x2-3"]);
    expect(section?.patternIds.every((patternId) => builtInPattern(patternId))).toBe(true);
  });

  it("exposes a complete 4x4 Bayer ramp", () => {
    const section = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "bayer-4x4");

    expect(section?.title).toBe("4x4 Bayer");
    expect(section?.patternIds).toHaveLength(15);
    expect(section?.patternIds).toEqual([
      "bayer-4x4-1",
      "bayer-4x4-2",
      "bayer-4x4-3",
      "bayer-4x4-4",
      "bayer-4x4-5",
      "bayer-4x4-6",
      "bayer-4x4-7",
      "bayer-4x4-8",
      "bayer-4x4-9",
      "bayer-4x4-10",
      "bayer-4x4-11",
      "bayer-4x4-12",
      "bayer-4x4-13",
      "bayer-4x4-14",
      "bayer-4x4-15",
    ]);
    expect(section?.patternIds.every((patternId) => builtInPattern(patternId))).toBe(true);
  });

  it("exposes vertical and diagonal hatch ramps", () => {
    const vertical = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "vertical-hatches");
    const diagonal = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "diagonal-hatches");

    expect(vertical?.title).toBe("Vertical Hatches");
    expect(vertical?.patternIds).toEqual(["hatch-vertical-1", "hatch-vertical-2", "hatch-vertical-3"]);
    expect(vertical?.patternIds.every((patternId) => builtInPattern(patternId))).toBe(true);
    expect(diagonal?.title).toBe("Diagonal Hatches");
    expect(diagonal?.patternIds).toEqual(["hatch-diagonal-1", "hatch-diagonal-2", "hatch-diagonal-3"]);
    expect(diagonal?.patternIds.every((patternId) => builtInPattern(patternId))).toBe(true);
  });

  it("builds 2x2 Bayer ramp masks from one through three filled cells", () => {
    const section = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "bayer-2x2");
    if (!section) throw new Error("Expected 2x2 Bayer section");

    const filledCounts = section.patternIds.map((patternId) => {
      const pattern = builtInPattern(patternId);
      if (!pattern) throw new Error(`Expected pattern ${patternId}`);
      return pattern.mask.filter(Boolean).length;
    });

    expect(filledCounts).toEqual([1, 2, 3]);
  });

  it("builds 4x4 Bayer ramp masks from one through fifteen filled cells", () => {
    const section = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "bayer-4x4");
    if (!section) throw new Error("Expected 4x4 Bayer section");

    const filledCounts = section.patternIds.map((patternId) => {
      const pattern = builtInPattern(patternId);
      if (!pattern) throw new Error(`Expected pattern ${patternId}`);
      return pattern.mask.filter(Boolean).length;
    });

    expect(filledCounts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("builds hatch ramps from one through three filled bands", () => {
    const vertical = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "vertical-hatches");
    const diagonal = PATTERN_LIBRARY_SECTIONS.find((candidate) => candidate.id === "diagonal-hatches");
    if (!vertical || !diagonal) throw new Error("Expected hatch sections");

    const filledCounts = [...vertical.patternIds, ...diagonal.patternIds].map((patternId) => {
      const pattern = builtInPattern(patternId);
      if (!pattern) throw new Error(`Expected pattern ${patternId}`);
      return pattern.mask.filter(Boolean).length;
    });

    expect(filledCounts).toEqual([4, 8, 12, 4, 8, 12]);
  });

  it("rotates samples around tile bounds when pattern dimensions are supplied", () => {
    const sampling = {
      offsetX: 0,
      offsetY: 0,
      reflectX: false,
      reflectY: false,
    };
    const bounds = { height: 4, width: 4 };

    expect(transformPatternPoint({ x: 0, y: 0 }, { ...sampling, rotation: 90 }, bounds)).toEqual({ x: 0, y: 3 });
    expect(transformPatternPoint({ x: 0, y: 0 }, { ...sampling, rotation: 180 }, bounds)).toEqual({ x: 3, y: 3 });
    expect(transformPatternPoint({ x: 0, y: 0 }, { ...sampling, rotation: 270 }, bounds)).toEqual({ x: 3, y: 0 });
  });

  it("keeps built-in pattern IDs unique", () => {
    const ids = BUILT_IN_PATTERNS.map((pattern) => pattern.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
