import { describe, expect, it } from "vitest";
import { createObjectDefinition, createRootStack, createSurface } from "./layers";
import { defaultProjectPalette } from "./palette";
import {
  layerStackUsesSwatchRefs,
  rasterizeSwatchRefsInLayerStack,
  rasterizeSwatchRefsInSurfaceAtOrigin,
  rasterizeSwatchAtSamplePoint,
} from "./rasterization";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "./types";
import type { EditorSnapshot } from "./types";
import { deletePatternSwatch } from "./paletteCommands";

describe("palette rasterization", () => {
  it("rasterizes one palette point through the shared resolver", () => {
    expect(rasterizeSwatchAtSamplePoint(defaultProjectPalette(), 4, { x: 0, y: 0 })).toBe(BLACK_PIXEL);
    expect(rasterizeSwatchAtSamplePoint(defaultProjectPalette(), 4, { x: 1, y: 0 })).toBe(WHITE_PIXEL);
  });

  it("rasterizes selected swatch refs in a pixel surface", () => {
    const surface = createSurface(2, 2);
    surface.data[0] = 4;
    surface.data[1] = 4;

    const result = rasterizeSwatchRefsInSurfaceAtOrigin(surface, defaultProjectPalette(), new Set([4]));

    expect(result.changed).toBe(true);
    expect(Array.from(result.value.data.slice(0, 2))).toEqual([BLACK_PIXEL, WHITE_PIXEL]);
    expect(Array.from(surface.data.slice(0, 2))).toEqual([4, 4]);
  });

  it("rasterizes surface refs using the provided sample origin", () => {
    const surface = createSurface(1, 1);
    surface.data[0] = 4;

    const result = rasterizeSwatchRefsInSurfaceAtOrigin(surface, defaultProjectPalette(), new Set([4]), { x: 1, y: 0 });

    expect(result.changed).toBe(true);
    expect(result.value.data[0]).toBe(WHITE_PIXEL);
  });

  it("rasterizes stack backgrounds into a reusable bottom pixel layer", () => {
    const stack = createRootStack();
    stack.width = 2;
    stack.height = 2;
    stack.background = 4;

    const result = rasterizeSwatchRefsInLayerStack(stack, defaultProjectPalette(), new Set([4]));

    expect(result.changed).toBe(true);
    expect(result.value.background).toBe(TRANSPARENT_PIXEL);
    expect(result.value.layers[0]?.type).toBe("pixel");
    if (result.value.layers[0]?.type === "pixel") {
      expect(Array.from(result.value.layers[0].surface.data.slice(0, 3))).toEqual([BLACK_PIXEL, WHITE_PIXEL, WHITE_PIXEL]);
    }
  });

  it("detects and deletes used pattern swatches after rasterizing references", () => {
    const snapshot: EditorSnapshot = {
      activeContext: { type: "root" },
      objects: [createObjectDefinition("object-1", "Object", 2, 2)],
      palette: defaultProjectPalette(),
      root: createRootStack(),
    };
    const rootLayer = snapshot.root.layers[0];
    if (rootLayer.type !== "pixel") throw new Error("Expected pixel layer");
    rootLayer.surface.data[0] = 4;
    snapshot.objects[0].background = 4;

    expect(layerStackUsesSwatchRefs(snapshot.root, new Set([4]))).toBe(true);

    const result = deletePatternSwatch(snapshot, 4);

    expect(result?.value.palette.entries.some((entry) => entry.ref === 4)).toBe(false);
    const deletedRootLayer = result?.value.root.layers[0];
    if (deletedRootLayer?.type !== "pixel") throw new Error("Expected pixel layer");
    expect(deletedRootLayer.surface.data[0]).toBe(BLACK_PIXEL);
    expect(result?.value.objects[0]?.background).toBe(TRANSPARENT_PIXEL);
    expect(result?.value.objects[0]?.layers[0]?.name).toBe("Rasterized background");
  });
});
