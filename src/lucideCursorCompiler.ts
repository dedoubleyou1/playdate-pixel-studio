interface LucideCursorLayer {
  svg: string;
  preserveStrokeWidth?: boolean;
  x?: number;
  y?: number;
  scale?: number;
}

interface LucideCursorOptions {
  fallback?: string;
  hotspot: {
    x: number;
    y: number;
  };
}

const CURSOR_STROKE_WIDTH = 2;

export function compileLucideCursor(layers: LucideCursorLayer[], options: LucideCursorOptions): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#171719" stroke-width="${CURSOR_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">`,
    ...layers.map(compileLayer),
    "</svg>",
  ].join("");

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${options.hotspot.x} ${options.hotspot.y}, ${
    options.fallback ?? "crosshair"
  }`;
}

function compileLayer(layer: LucideCursorLayer): string {
  const content = extractSvgContent(layer.svg);
  const transform = compileTransform(layer);
  const attributes = compileLayerAttributes(layer);

  return transform || attributes ? `<g${transform ? ` transform="${transform}"` : ""}${attributes}>${content}</g>` : content;
}

function compileLayerAttributes({ preserveStrokeWidth, scale }: LucideCursorLayer): string {
  if (!preserveStrokeWidth || !scale || scale === 1) return "";
  return ` stroke-width="${formatNumber(CURSOR_STROKE_WIDTH / scale)}"`;
}

function compileTransform({ scale, x, y }: LucideCursorLayer): string {
  const transforms = [];
  if (x || y) transforms.push(`translate(${x ?? 0} ${y ?? 0})`);
  if (scale && scale !== 1) transforms.push(`scale(${scale})`);
  return transforms.join(" ");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function extractSvgContent(svg: string): string {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/);
  return match?.[1]?.trim() ?? "";
}
