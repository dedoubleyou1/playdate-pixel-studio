import { describe, expect, it } from "vitest";
import {
  canvasSelectionToLayerMask,
  cloneBinaryMaskSurface,
  createBinaryMaskSurface,
  createEllipseMask,
  createRectMask,
  createSelectionStateFromMask,
  invertBinaryMaskSurface,
  maskBounds,
  maskIsEmpty,
  translateBinaryMaskSurface,
} from "./masks";

describe("binary mask helpers", () => {
  it("creates, clones, and inverts binary masks", () => {
    const mask = createBinaryMaskSurface(3, 2);
    mask.data[1] = 1;
    const clone = cloneBinaryMaskSurface(mask);
    const inverted = invertBinaryMaskSurface(mask);

    expect(clone).toEqual(mask);
    expect(clone.data).not.toBe(mask.data);
    expect(Array.from(inverted.data)).toEqual([1, 0, 1, 1, 1, 1]);
  });

  it("creates rectangular masks and computes bounds", () => {
    const mask = createRectMask(5, 5, { x: 3, y: 3 }, { x: 1, y: 2 });
    const selection = createSelectionStateFromMask(mask);

    expect(maskIsEmpty(mask)).toBe(false);
    expect(maskBounds(mask)).toEqual({ left: 1, top: 2, right: 3, bottom: 3 });
    expect(selection.isEmpty).toBe(false);
    expect(selection.bounds).toEqual({ left: 1, top: 2, right: 3, bottom: 3 });
    expect(mask.data[2 * 5 + 1]).toBe(1);
    expect(mask.data[4 * 5 + 4]).toBe(0);
  });

  it("creates elliptical masks", () => {
    const mask = createEllipseMask(7, 7, { x: 1, y: 1 }, { x: 5, y: 5 });
    const selection = createSelectionStateFromMask(mask);

    expect(maskBounds(mask)).toEqual({ left: 1, top: 1, right: 5, bottom: 5 });
    expect(selection.isEmpty).toBe(false);
    expect(selection.bounds).toEqual({ left: 1, top: 1, right: 5, bottom: 5 });
    expect(mask.data[3 * 7 + 3]).toBe(1);
    expect(mask.data[1 * 7 + 1]).toBe(0);
    expect(mask.data[1 * 7 + 3]).toBe(1);
    expect(mask.data[3 * 7 + 1]).toBe(1);
  });

  it("translates masks with clipping", () => {
    const mask = createRectMask(4, 4, { x: 0, y: 0 }, { x: 1, y: 1 });
    const translated = translateBinaryMaskSurface(mask, 2, 1);

    expect(maskBounds(translated)).toEqual({ left: 2, top: 1, right: 3, bottom: 2 });
  });

  it("marks empty selection metadata without scanning at read sites", () => {
    const selection = createSelectionStateFromMask(createBinaryMaskSurface(2, 2));

    expect(selection.isEmpty).toBe(true);
    expect(selection.bounds).toBeNull();
  });

  it("converts canvas selections to layer-local masks", () => {
    const selection = createRectMask(6, 6, { x: 2, y: 2 }, { x: 4, y: 4 });
    const layerMask = canvasSelectionToLayerMask(selection, 3, 3, { x: 2, y: 2 });

    expect(Array.from(layerMask.data)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});
