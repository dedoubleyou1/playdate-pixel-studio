import { describe, expect, it } from "vitest";
import { checkerDitherPaint, paintValueAt, solidPaint } from "./paintSources";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";

describe("paint sources", () => {
  it("returns a constant value for solid paint", () => {
    const paint = solidPaint(WHITE_PIXEL);

    expect(paint.type).toBe("solid");
    if (paint.type !== "solid") throw new Error("Expected solid paint");
    expect(paint.value).toBe(WHITE_PIXEL);
    expect(paintValueAt(paint, { x: 0, y: 0 })).toBe(WHITE_PIXEL);
    expect(paintValueAt(paint, { x: 12, y: 9 })).toBe(WHITE_PIXEL);
  });

  it("returns foreground and background values for checker dither", () => {
    const paint = checkerDitherPaint({ foreground: BLACK_PIXEL, background: TRANSPARENT_PIXEL });

    expect(paint.type).toBe("pattern");
    expect(paintValueAt(paint, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(paintValueAt(paint, { x: 1, y: 0 })).toBe(TRANSPARENT_PIXEL);
    expect(paintValueAt(paint, { x: 1, y: 1 })).toBe(BLACK_PIXEL);
  });
});
