interface LucideCursorLayer {
  svg: string;
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

export function compileLucideCursor(layers: LucideCursorLayer[], options: LucideCursorOptions): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#171719" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
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

  return transform ? `<g transform="${transform}">${content}</g>` : content;
}

function compileTransform({ scale, x, y }: LucideCursorLayer): string {
  const transforms = [];
  if (x || y) transforms.push(`translate(${x ?? 0} ${y ?? 0})`);
  if (scale && scale !== 1) transforms.push(`scale(${scale})`);
  return transforms.join(" ");
}

function extractSvgContent(svg: string): string {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/);
  return match?.[1]?.trim() ?? "";
}
