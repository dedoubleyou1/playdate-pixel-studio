import eraserCursor from "lucide-static/icons/eraser.svg?url";
import moveCursor from "lucide-static/icons/move.svg?url";
import penToolCursor from "lucide-static/icons/pen-tool.svg?url";
import pencilCursor from "lucide-static/icons/pencil.svg?url";
import ArrowUpLeft from "lucide-static/dist/esm/icons/arrow-up-left.mjs";
import PaintBucket from "lucide-static/dist/esm/icons/paint-bucket.mjs";
import type { Tool } from "./domain/types";
import { compileLucideCursor } from "./lucideCursorCompiler";

const CROSSHAIR_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 12 L12 12" />
  <path d="M12 16 L12 21" />
  <path d="M12 3 L12 8" />
  <path d="M16 12 L21 12" />
  <path d="M3 12 L8 12" />
</svg>`;

const crosshairCursor = compileLucideCursor([{ svg: CROSSHAIR_CURSOR_SVG }], {
  hotspot: { x: 12, y: 12 },
});

const TOOL_CURSORS: Record<Tool, string> = {
  move: `url("${moveCursor}") 12 12, move`,
  marquee: crosshairCursor,
  ellipseSelect: crosshairCursor,
  pencil: `url("${pencilCursor}") 1 22, crosshair`,
  eraser: `url("${eraserCursor}") 1 22, crosshair`,
  line: `url("${penToolCursor}") 0 0, crosshair`,
  rect: crosshairCursor,
  ellipse: crosshairCursor,
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
