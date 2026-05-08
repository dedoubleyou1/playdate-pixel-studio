import { cn } from "@/lib/utils";
import { paletteEntryForIndex } from "../domain/palette";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { PixelValue, ProjectPalette } from "../domain/types";

const SWATCH_CLASSES: Record<number, string> = {
  [TRANSPARENT_PIXEL]: "bg-muted",
  [BLACK_PIXEL]: "bg-foreground",
  [WHITE_PIXEL]: "bg-background",
};

function PixelSwatch({
  className,
  palette,
  value,
}: {
  className?: string;
  palette?: ProjectPalette;
  value: PixelValue;
}): React.JSX.Element {
  const entry = palette ? paletteEntryForIndex(palette, value) : null;
  const style =
    entry?.type === "dither"
      ? {
          backgroundColor: "var(--background)",
          backgroundImage:
            entry.patternId === "checker-25"
              ? "linear-gradient(135deg, var(--foreground) 25%, transparent 25%)"
              : entry.patternId === "checker-75"
                ? "linear-gradient(135deg, var(--foreground) 75%, transparent 75%)"
                : "linear-gradient(45deg, var(--foreground) 25%, transparent 25%, transparent 75%, var(--foreground) 75%)",
        }
      : undefined;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 rounded-sm border border-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_55%)]",
        entry?.type === "dither" ? null : SWATCH_CLASSES[value],
        className,
      )}
      style={style}
    />
  );
}

export { PixelSwatch };
