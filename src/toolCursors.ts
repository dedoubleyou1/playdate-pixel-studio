import eraserCursor from "lucide-static/icons/eraser.svg?url";
import penToolCursor from "lucide-static/icons/pen-tool.svg?url";
import pencilCursor from "lucide-static/icons/pencil.svg?url";
import squareCursor from "lucide-static/icons/square.svg?url";
import Ellipsis from "lucide-static/dist/esm/icons/ellipsis.mjs";
import MousePointer2 from "lucide-static/dist/esm/icons/mouse-pointer-2.mjs";
import PaintBucket from "lucide-static/dist/esm/icons/paint-bucket.mjs";
import Pen from "lucide-static/dist/esm/icons/pen.mjs";
import type { Tool } from "./domain/types";
import { compileLucideCursor } from "./lucideCursorCompiler";

const TOOL_CURSORS: Record<Tool, string> = {
  pencil: `url("${pencilCursor}") 1 22, crosshair`,
  eraser: `url("${eraserCursor}") 1 22, crosshair`,
  fill: compileLucideCursor([{ svg: MousePointer2 }, { svg: PaintBucket, x: 8, y: 8, scale: 0.55 }], {
    hotspot: { x: 4, y: 4 },
  }),
  line: `url("${penToolCursor}") 1 22, crosshair`,
  rect: `url("${squareCursor}") 5 6, crosshair`,
  dither: compileLucideCursor([{ svg: Pen }, { svg: Ellipsis, x: -2, y: 9.5 }], {
    hotspot: { x: 4, y: 20 },
  }),
};

export function toolCursor(tool: Tool): string {
  return TOOL_CURSORS[tool];
}
