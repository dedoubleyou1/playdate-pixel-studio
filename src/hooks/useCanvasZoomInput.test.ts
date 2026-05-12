import { describe, expect, it } from "vitest";
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, clampCanvasZoom, sliderValueToZoom } from "./useCanvasZoomInput";

describe("canvas zoom input helpers", () => {
  it("keeps zoom inside the supported range", () => {
    expect(clampCanvasZoom(MIN_ZOOM - 1)).toBe(MIN_ZOOM);
    expect(clampCanvasZoom(DEFAULT_ZOOM)).toBe(DEFAULT_ZOOM);
    expect(clampCanvasZoom(MAX_ZOOM + 1)).toBe(MAX_ZOOM);
  });

  it("normalizes slider values before updating zoom", () => {
    expect(sliderValueToZoom(undefined)).toBe(MIN_ZOOM);
    expect(sliderValueToZoom(4)).toBe(4);
    expect(sliderValueToZoom(99)).toBe(MAX_ZOOM);
  });
});
