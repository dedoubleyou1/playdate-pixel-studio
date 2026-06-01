import { cn } from "@/lib/utils";
import {
  paletteEntryForIndex,
  projectPaletteKey,
  resolvePaletteEntryPreviewColor,
} from "../domain/palette";
import { builtInPattern } from "../domain/patterns";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { PixelValue, ProjectPalette } from "../domain/types";

const SWATCH_CLASSES: Record<number, string> = {
  [TRANSPARENT_PIXEL]: "bg-muted",
  [BLACK_PIXEL]: "bg-foreground",
  [WHITE_PIXEL]: "bg-background",
};
const ditherSwatchImageCache = new Map<string, string>();

function PixelSwatch({
  className,
  colorizedPatterns = false,
  palette,
  sampleSize = 8,
  swatchSize = sampleSize * 2,
  value,
}: {
  className?: string;
  colorizedPatterns?: boolean;
  palette?: ProjectPalette;
  sampleSize?: number;
  swatchSize?: number;
  value: PixelValue;
}): React.JSX.Element {
  const entry = palette ? paletteEntryForIndex(palette, value) : null;
  const style =
    entry?.type === "pattern" && palette
      ? ditherSwatchStyle(palette, entry.patternId, value, sampleSize, swatchSize, colorizedPatterns)
      : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 rounded-sm border border-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_55%)]",
        entry?.type === "pattern" ? null : SWATCH_CLASSES[value],
        className,
      )}
      style={style}
    />
  );
}

function ditherSwatchStyle(
  palette: ProjectPalette,
  patternId: string,
  value: PixelValue,
  sampleSize: number,
  swatchSize: number,
  colorizedPatterns: boolean,
): React.CSSProperties {
  const image = ditherSwatchImage(palette, patternId, value, sampleSize, swatchSize, colorizedPatterns);
  if (!image) return {};

  return {
    backgroundColor: "#fff",
    backgroundImage: `url("${image}")`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    imageRendering: "pixelated",
  };
}

function ditherSwatchImage(
  palette: ProjectPalette,
  patternId: string,
  value: PixelValue,
  sampleSize: number,
  swatchSize: number,
  colorizedPatterns: boolean,
): string | null {
  if (typeof document === "undefined") return null;

  const pattern = builtInPattern(patternId);
  if (!pattern) return null;

  const size = Math.max(1, Math.floor(sampleSize));
  const outputSize = Math.max(size, Math.floor(swatchSize));
  const cacheKey = `${projectPaletteKey(palette)}:${patternId}:${value}:${size}:${outputSize}:${colorizedPatterns}`;
  const cached = ditherSwatchImageCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const cellSize = outputSize / size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = resolvePaletteEntryPreviewColor(palette, value, { x, y }, { colorizedPatterns });
      context.fillStyle = color ? `rgb(${color.r} ${color.g} ${color.b})` : "#d4d4d8";
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  const image = canvas.toDataURL("image/png");
  ditherSwatchImageCache.set(cacheKey, image);
  return image;
}

export { PixelSwatch };
