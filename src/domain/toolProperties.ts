import type { Tool } from "./types";

export function toolUsesBrushSize(tool: Tool): boolean {
  return tool === "pencil" || tool === "eraser" || tool === "line" || tool === "rect" || tool === "ellipse";
}
