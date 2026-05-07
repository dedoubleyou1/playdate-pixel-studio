import eraserCursor from "lucide-static/icons/eraser.svg?url";
import paintBucketCursor from "lucide-static/icons/paint-bucket.svg?url";
import pencilCursor from "lucide-static/icons/pencil.svg?url";
import slashCursor from "lucide-static/icons/slash.svg?url";
import squareCursor from "lucide-static/icons/square.svg?url";
import type { Tool } from "./domain/types";
import ditherCursor from "./assets/cursors/dither-pencil-ellipsis.svg?url";

const TOOL_CURSORS: Record<Tool, string> = {
  pencil: `url("${pencilCursor}") 4 20, crosshair`,
  eraser: `url("${eraserCursor}") 8 17, crosshair`,
  fill: `url("${paintBucketCursor}") 19 20, crosshair`,
  line: `url("${slashCursor}") 5 19, crosshair`,
  rect: `url("${squareCursor}") 5 6, crosshair`,
  dither: `url("${ditherCursor}") 4 20, crosshair`,
};

export function toolCursor(tool: Tool): string {
  return TOOL_CURSORS[tool];
}
