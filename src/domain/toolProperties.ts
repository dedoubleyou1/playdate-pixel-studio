import type { Tool } from "./types";

export function toolUsesSizeAndMirror(tool: Tool): boolean {
  return tool === "pencil" || tool === "eraser" || tool === "line" || tool === "rect" || tool === "ellipse";
}
