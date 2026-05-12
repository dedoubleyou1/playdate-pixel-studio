import { describe, expect, it } from "vitest";
import { toolCursor } from "../toolCursors";
import { deriveCanvasCursor, type CanvasCursorState } from "./useCanvasCursor";

const BASE_STATE: CanvasCursorState = {
  activeSelectionCombineMode: null,
  activeTool: "pencil",
  drawingEnabled: true,
  hasActiveLayer: true,
  hoverSelectionCombineMode: null,
  maskEditingEnabled: false,
};

describe("deriveCanvasCursor", () => {
  it("uses selection cursor variants from active drag mode first", () => {
    expect(
      deriveCanvasCursor({
        ...BASE_STATE,
        activeSelectionCombineMode: "subtract",
        activeTool: "marquee",
        hoverSelectionCombineMode: "add",
      }),
    ).toBe(toolCursor("marquee", "subtract"));
  });

  it("uses selection cursor variants from hover modifiers", () => {
    expect(
      deriveCanvasCursor({
        ...BASE_STATE,
        activeTool: "ellipseSelect",
        hoverSelectionCombineMode: "add",
      }),
    ).toBe(toolCursor("ellipseSelect", "add"));
  });

  it("allows move only when a layer is selected", () => {
    expect(deriveCanvasCursor({ ...BASE_STATE, activeTool: "move", hasActiveLayer: true })).toBe(toolCursor("move"));
    expect(deriveCanvasCursor({ ...BASE_STATE, activeTool: "move", hasActiveLayer: false })).toBe("not-allowed");
  });

  it("allows drawing tools when pixels or alpha masks are editable", () => {
    expect(deriveCanvasCursor({ ...BASE_STATE, activeTool: "pencil", drawingEnabled: true })).toBe(toolCursor("pencil"));
    expect(
      deriveCanvasCursor({
        ...BASE_STATE,
        activeTool: "eraser",
        drawingEnabled: false,
        maskEditingEnabled: true,
      }),
    ).toBe(toolCursor("eraser"));
  });

  it("disables drawing tools for non-editable layers", () => {
    expect(
      deriveCanvasCursor({
        ...BASE_STATE,
        activeTool: "fill",
        drawingEnabled: false,
        maskEditingEnabled: false,
      }),
    ).toBe("not-allowed");
  });
});
