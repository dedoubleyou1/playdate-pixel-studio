import { describe, expect, it } from "vitest";
import { toolUsesSizeAndMirror } from "./toolProperties";
import type { Tool } from "./types";

describe("tool properties", () => {
  it("exposes size and mirror controls only for drawing tools that consume them", () => {
    const toolsWithSizeAndMirror: Tool[] = ["pencil", "eraser", "line", "rect", "ellipse"];
    const toolsWithoutSizeAndMirror: Tool[] = ["marquee", "ellipseSelect", "move", "fill"];

    expect(toolsWithSizeAndMirror.every(toolUsesSizeAndMirror)).toBe(true);
    expect(toolsWithoutSizeAndMirror.every((tool) => !toolUsesSizeAndMirror(tool))).toBe(true);
  });
});
