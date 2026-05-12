import { describe, expect, it } from "vitest";
import { toolCursor } from "./toolCursors";

describe("toolCursor", () => {
  it("returns selection cursor variants for active combine modes", () => {
    const normalCursor = toolCursor("marquee");
    const addCursor = toolCursor("marquee", "add");
    const subtractCursor = toolCursor("marquee", "subtract");

    expect(addCursor).not.toBe(normalCursor);
    expect(subtractCursor).not.toBe(normalCursor);
    expect(addCursor).not.toBe(subtractCursor);
    expect(decodedCursorSvg(addCursor)).toContain("M19 17 L19 21");
    expect(decodedCursorSvg(subtractCursor)).toContain("M17 19 L21 19");
  });

  it("ignores selection combine cursor variants for non-selection tools", () => {
    expect(toolCursor("rect", "add")).toBe(toolCursor("rect"));
    expect(toolCursor("ellipse", "subtract")).toBe(toolCursor("ellipse"));
  });
});

function decodedCursorSvg(cursor: string): string {
  const encodedSvg = cursor.match(/url\("data:image\/svg\+xml,([^"]+)"\)/)?.[1];
  return decodeURIComponent(encodedSvg ?? "");
}
