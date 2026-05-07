import eraserCursor from "lucide-static/icons/eraser.svg?url";
import paintBucketCursor from "lucide-static/icons/paint-bucket.svg?url";
import pencilCursor from "lucide-static/icons/pencil.svg?url";
import slashCursor from "lucide-static/icons/slash.svg?url";
import squareCursor from "lucide-static/icons/square.svg?url";
import Ellipsis from "lucide-static/dist/esm/icons/ellipsis.mjs";
import Pencil from "lucide-static/dist/esm/icons/pencil.mjs";
import type { Tool } from "./domain/types";

const ditherCursor = svgCursor(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" color="#171719">
    ${nestSvg(Pencil)}
    ${nestSvg(Ellipsis, `x="7" y="-2" width="16" height="16"`)}
  </svg>`,
);

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

function nestSvg(svg: string, attributes = ""): string {
  return svg.trim().replace("<svg", `<svg ${attributes}`.trimEnd());
}

function svgCursor(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
