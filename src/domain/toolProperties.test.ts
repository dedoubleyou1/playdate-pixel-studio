import { describe, expect, it } from "vitest";
import { toolUsesBrushSize } from "./toolProperties";
import type { Tool } from "./types";

describe("tool properties", () => {
  it("exposes size controls only for drawing tools that consume brush size", () => {
    const toolsWithBrushSize: Tool[] = ["pencil", "eraser", "line", "rect", "ellipse"];
    const toolsWithoutBrushSize: Tool[] = ["marquee", "ellipseSelect", "move", "fill"];

    expect(toolsWithBrushSize.every(toolUsesBrushSize)).toBe(true);
    expect(toolsWithoutBrushSize.every((tool) => !toolUsesBrushSize(tool))).toBe(true);
  });
});
