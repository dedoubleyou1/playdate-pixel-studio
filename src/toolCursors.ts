import eraserCursor from "lucide-static/icons/eraser.svg?url";
import penToolCursor from "lucide-static/icons/pen-tool.svg?url";
import pencilCursor from "lucide-static/icons/pencil.svg?url";
import crosshairCursor from "lucide-static/icons/plus.svg?url";
import Ellipsis from "lucide-static/dist/esm/icons/ellipsis.mjs";
import ArrowUpLeft from "lucide-static/dist/esm/icons/arrow-up-left.mjs";
import PaintBucket from "lucide-static/dist/esm/icons/paint-bucket.mjs";
import Pen from "lucide-static/dist/esm/icons/pen.mjs";
import type { Tool } from "./domain/types";
import { compileLucideCursor } from "./lucideCursorCompiler";

const TOOL_CURSORS: Record<Tool, string> = {
  pencil: `url("${pencilCursor}") 1 22, crosshair`,
  eraser: `url("${eraserCursor}") 1 22, crosshair`,
  line: `url("${penToolCursor}") 0 0, crosshair`,
  rect: `url("${crosshairCursor}") 11 11, crosshair`,
  dither: compileLucideCursor([{ svg: Pen }, { svg: Ellipsis, x: -2, y: 9.5 }], {
    hotspot: { x: 1, y: 22 },
  }),
  fill: compileLucideCursor(
    [
      { svg: ArrowUpLeft, preserveStrokeWidth: true, scale: 0.4 },
      { svg: PaintBucket, preserveStrokeWidth: true, x: 4, y: 4, scale: 0.8 },
    ],
    {
      hotspot: { x: 0, y: 0 },
    },
  ),
};

export function toolCursor(tool: Tool): string {
  return TOOL_CURSORS[tool];
}
