import { describe, expect, it } from "vitest";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { selectionOverlaySource } from "./selectionOverlaySource";

describe("selectionOverlaySource", () => {
  it("uses marquee previews before pending moves or committed selections", () => {
    const committed = createBinaryMaskSurface(5, 5);
    committed.data[indexFor(4, 4, 5)] = 1;
    const pending = createBinaryMaskSurface(5, 5);
    pending.data[indexFor(3, 3, 5)] = 1;

    const source = selectionOverlaySource({
      activeSelection: { mask: committed },
      height: 5,
      pendingSelectionMove: { dx: 2, dy: 1, floating: { mask: pending } },
      selectionPreview: {
        brushSize: 1,
        end: { x: 1, y: 1 },
        mirrorX: false,
        mirrorY: false,
        start: { x: 0, y: 0 },
        type: "rect",
      },
      width: 5,
    });

    expect(source.dx).toBe(0);
    expect(source.dy).toBe(0);
    expect(source.mask?.data[indexFor(0, 0, 5)]).toBe(1);
    expect(source.mask?.data[indexFor(1, 1, 5)]).toBe(1);
    expect(source.mask?.data[indexFor(3, 3, 5)]).toBe(0);
    expect(source.mask?.data[indexFor(4, 4, 5)]).toBe(0);
  });

  it("can resolve ellipse selection previews", () => {
    const source = selectionOverlaySource({
      activeSelection: null,
      height: 5,
      pendingSelectionMove: null,
      selectionPreview: {
        brushSize: 1,
        end: { x: 4, y: 4 },
        mirrorX: false,
        mirrorY: false,
        start: { x: 0, y: 0 },
        type: "ellipse",
      },
      width: 5,
    });

    expect(source.mask?.data[indexFor(2, 2, 5)]).toBe(1);
    expect(source.mask?.data[indexFor(0, 0, 5)]).toBe(0);
  });

  it("uses pending selection moves before committed selections", () => {
    const committed = createBinaryMaskSurface(5, 5);
    committed.data[indexFor(4, 4, 5)] = 1;
    const pending = createBinaryMaskSurface(5, 5);
    pending.data[indexFor(3, 3, 5)] = 1;

    const source = selectionOverlaySource({
      activeSelection: { mask: committed },
      height: 5,
      pendingSelectionMove: { dx: 2, dy: 1, floating: { mask: pending } },
      selectionPreview: null,
      width: 5,
    });

    expect(source.dx).toBe(2);
    expect(source.dy).toBe(1);
    expect(source.mask).toBe(pending);
  });

  it("uses committed selection when no preview or move exists", () => {
    const committed = createBinaryMaskSurface(5, 5);

    expect(
      selectionOverlaySource({
        activeSelection: { mask: committed },
        height: 5,
        pendingSelectionMove: null,
        selectionPreview: null,
        width: 5,
      }),
    ).toEqual({ dx: 0, dy: 0, mask: committed });
  });
});
