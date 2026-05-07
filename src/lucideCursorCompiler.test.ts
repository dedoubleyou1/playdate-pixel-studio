import { describe, expect, it } from "vitest";
import { compileLucideCursor } from "./lucideCursorCompiler";

const TEST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" /></svg>`;

describe("compileLucideCursor", () => {
  it("can preserve apparent stroke width for scaled layers", () => {
    const cursor = compileLucideCursor([{ svg: TEST_ICON, preserveStrokeWidth: true, scale: 0.5 }], {
      hotspot: { x: 4, y: 4 },
    });

    const encodedSvg = cursor.match(/url\("data:image\/svg\+xml,([^"]+)"\)/)?.[1];
    expect(encodedSvg).toBeDefined();
    expect(decodeURIComponent(encodedSvg ?? "")).toContain('<g transform="scale(0.5)" stroke-width="4">');
  });
});
