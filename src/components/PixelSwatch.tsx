import { cn } from "@/lib/utils";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { PixelValue } from "../domain/types";

const SWATCH_CLASSES: Record<PixelValue, string> = {
  [TRANSPARENT_PIXEL]: "bg-muted",
  [BLACK_PIXEL]: "bg-foreground",
  [WHITE_PIXEL]: "bg-background",
};

function PixelSwatch({ className, value }: { className?: string; value: PixelValue }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 rounded-sm border border-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_55%)]",
        SWATCH_CLASSES[value],
        className,
      )}
    />
  );
}

export { PixelSwatch };
