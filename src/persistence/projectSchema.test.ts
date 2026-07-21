import { describe, expect, it } from "vitest";
import { PLAYDATE_HEIGHT, PLAYDATE_WIDTH } from "../domain/constants";
import {
  createDefaultPalette,
  createObjectDefinition,
  createObjectInstanceLayer,
  createRootStack,
} from "../domain/layers";
import { createBinaryMaskSurface } from "../domain/masks";
import { indexFor } from "../domain/pixelGeometry";
import { BLACK_PIXEL, TRANSPARENT_PIXEL, WHITE_PIXEL } from "../domain/types";
import type { EditorSnapshot } from "../domain/types";
import { deserializeProject, parseProjectJson, PROJECT_SCHEMA_VERSION, serializeProject } from "./projectSchema";

describe("project schema", () => {
  it("round-trips a Playdate project document", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
      activeContext: { type: "root" },
    };
    snapshot.root.background = BLACK_PIXEL;
    snapshot.objects[0].background = TRANSPARENT_PIXEL;
    const layer = snapshot.root.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected a pixel layer");
    layer.surface.data[indexFor(20, 30)] = BLACK_PIXEL;
    layer.surface.data[indexFor(21, 30)] = WHITE_PIXEL;

    const document = serializeProject(snapshot, "project-1", "Test Project");
    const restored = deserializeProject(document);
    const restoredLayer = restored.root.layers[0];

    expect(document.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(document.width).toBe(PLAYDATE_WIDTH);
    expect(document.height).toBe(PLAYDATE_HEIGHT);
    expect(document.snapshot.palette.entries).toHaveLength(snapshot.palette.entries.length);
    expect(document.snapshot.palette.entries[3]).toMatchObject({ type: "pattern", patternId: "bayer-2x2-1" });
    expect(document.snapshot.root.layers[0]).toMatchObject({ pixelEditable: true, contentRevision: 0 });
    expect("locked" in document.snapshot.root.layers[0]).toBe(false);
    expect("opacity" in document.snapshot.root.layers[0]).toBe(false);
    expect(restored.root.background).toBe(BLACK_PIXEL);
    expect(restored.objects[0]?.background).toBe(TRANSPARENT_PIXEL);
    expect(restoredLayer.type).toBe("pixel");
    if (restoredLayer.type === "pixel") {
      expect(restoredLayer.surface.data[indexFor(20, 30)]).toBe(BLACK_PIXEL);
      expect(restoredLayer.surface.data[indexFor(21, 30)]).toBe(WHITE_PIXEL);
    }
  });

  it("rejects unsupported imported files", () => {
    expect(() => parseProjectJson("{}")).toThrow(/not a Playdate Pixel Studio project/);
    expect(() => parseProjectJson(JSON.stringify({ schemaVersion: 1 }))).toThrow(/not a Playdate Pixel Studio project/);
  });

  it("rejects hostile dimensions before allocating surface storage", () => {
    const document = createValidDocument();
    document.snapshot.objects[0].width = 1_000_000_000;

    expect(() => parseProjectJson(JSON.stringify(document))).toThrow(/object 0 width is out of range/);
  });

  it("rejects truncated surface data instead of silently zero-filling it", () => {
    const document = createValidDocument();
    const layer = document.snapshot.root.layers[0];
    if (layer.type !== "pixel") throw new Error("Expected a pixel layer");
    layer.surface.data = layer.surface.data.slice(0, -4);

    expect(() => parseProjectJson(JSON.stringify(document))).toThrow(/surface data length is invalid/);
  });

  it("rejects missing required solid palette entries", () => {
    const document = createValidDocument();
    document.snapshot.palette.entries = document.snapshot.palette.entries.filter((entry) => entry.ref !== WHITE_PIXEL);

    expect(() => parseProjectJson(JSON.stringify(document))).toThrow(/required white palette entry is missing/);
  });

  it("rejects palette entries that reference unknown patterns", () => {
    const document = createValidDocument();
    const entry = document.snapshot.palette.entries[3];
    if (entry.type !== "pattern") throw new Error("Expected a pattern swatch");
    entry.patternId = "missing-pattern";

    expect(() => parseProjectJson(JSON.stringify(document))).toThrow(/references an unknown pattern/);
  });

  it("rejects invalid pixel and alpha-mask values", () => {
    const invalidPixelDocument = createValidDocument();
    const pixelLayer = invalidPixelDocument.snapshot.root.layers[0];
    if (pixelLayer.type !== "pixel") throw new Error("Expected a pixel layer");
    pixelLayer.surface.data = replaceFirstBase64Byte(pixelLayer.surface.data, 63);
    expect(() => parseProjectJson(JSON.stringify(invalidPixelDocument))).toThrow(/missing palette entry/);

    const invalidMaskDocument = createValidDocument();
    const maskLayer = invalidMaskDocument.snapshot.root.layers[0];
    if (maskLayer.type !== "pixel") throw new Error("Expected a pixel layer");
    maskLayer.alphaMask = { ...maskLayer.surface, data: replaceFirstBase64Byte(maskLayer.surface.data, 2) };
    expect(() => parseProjectJson(JSON.stringify(invalidMaskDocument))).toThrow(/non-binary value/);
  });

  it("rejects dangling object references and edit contexts", () => {
    const instanceDocument = createValidDocument();
    instanceDocument.snapshot.root.layers.push({
      type: "object",
      id: 2,
      name: "Missing object",
      visible: true,
      pixelEditable: false,
      contentRevision: 0,
      objectId: "missing-object",
      x: 0,
      y: 0,
    });
    expect(() => parseProjectJson(JSON.stringify(instanceDocument))).toThrow(/references a missing object/);

    const contextDocument = createValidDocument();
    contextDocument.snapshot.activeContext = { type: "object", objectId: "missing-object" };
    expect(() => parseProjectJson(JSON.stringify(contextDocument))).toThrow(/references a missing object/);
  });

  it("accepts an object-instance alpha mask whose dimensions predate an object resize", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
      activeContext: { type: "root" },
    };
    const instance = createObjectInstanceLayer(2, "Object 1", "object-1");
    instance.alphaMask = createBinaryMaskSurface(8, 8, true);
    snapshot.root.layers.push(instance);
    snapshot.root.nextLayerId = 3;

    const parsed = parseProjectJson(JSON.stringify(serializeProject(snapshot, "project-1", "Masked object")));
    const restored = deserializeProject(parsed);
    const restoredInstance = restored.root.layers[1];

    expect(restoredInstance.type).toBe("object");
    expect(restoredInstance.alphaMask).toMatchObject({ width: 8, height: 8 });
  });

  it("clamps invalid active layer indexes while deserializing", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
      activeContext: { type: "root" },
    };
    const document = serializeProject(snapshot, "project-1", "Invalid Active Layer") as unknown as {
      snapshot: {
        root: { activeLayerIndex: number };
        objects: Array<{ activeLayerIndex: number }>;
      };
    };
    document.snapshot.root.activeLayerIndex = 99;
    document.snapshot.objects[0].activeLayerIndex = 99;

    const restored = deserializeProject(document as never);

    expect(restored.root.activeLayerIndex).toBe(0);
    expect(restored.objects[0].activeLayerIndex).toBe(0);
  });

  it("repairs missing and duplicated swatch preview hues while deserializing", () => {
    const document = serializeProject(
      {
        palette: createDefaultPalette(),
        root: createRootStack(),
        objects: [],
        activeContext: { type: "root" },
      },
      "project-1",
      "Preview Hues",
    ) as unknown as {
      snapshot: {
        palette: {
          entries: Array<Record<string, unknown>>;
        };
      };
    };
    for (const index of [3, 4, 5]) {
      document.snapshot.palette.entries[index].previewHue = 210;
    }

    const restored = deserializeProject(document as never);
    const previewHues = restored.palette.entries
      .filter((entry) => entry.type === "pattern")
      .map((entry) => entry.previewHue);

    expect(previewHues).toEqual([210, 300, 120]);
  });

  it("round-trips pattern sampling settings", () => {
    const snapshot: EditorSnapshot = {
      palette: createDefaultPalette(),
      root: createRootStack(),
      objects: [],
      activeContext: { type: "root" },
    };
    const entry = snapshot.palette.entries[3];
    if (entry.type !== "pattern") throw new Error("Expected pattern swatch");
    snapshot.palette.entries[3] = {
      ...entry,
      offsetX: 3,
      offsetY: -2,
      previewHue: 55,
      reflectX: true,
      rotation: 90,
    };

    const restored = deserializeProject(serializeProject(snapshot, "project-1", "Sampling"));

    expect(restored.palette.entries[3]).toMatchObject({
      offsetX: 3,
      offsetY: -2,
      previewHue: 55,
      reflectX: true,
      reflectY: false,
      rotation: 90,
    });
  });

  it("repairs missing pattern IDs and duplicate swatch refs", () => {
    const document = serializeProject(
      {
        palette: createDefaultPalette(),
        root: createRootStack(),
        objects: [],
        activeContext: { type: "root" },
      },
      "project-1",
      "Invalid Palette",
    );
    const firstPattern = document.snapshot.palette.entries[3];
    const secondPattern = document.snapshot.palette.entries[4];
    if (firstPattern.type !== "pattern" || secondPattern.type !== "pattern")
      throw new Error("Expected pattern swatches");
    firstPattern.patternId = "missing-pattern";
    secondPattern.ref = firstPattern.ref;

    const restored = deserializeProject(document);

    expect(restored.palette.entries[3]).toMatchObject({ patternId: "bayer-2x2-2" });
    expect(new Set(restored.palette.entries.map((entry) => entry.ref)).size).toBe(restored.palette.entries.length);
  });
});

function createValidDocument() {
  const snapshot: EditorSnapshot = {
    palette: createDefaultPalette(),
    root: createRootStack(),
    objects: [createObjectDefinition("object-1", "Object 1", 16, 16)],
    activeContext: { type: "root" },
  };
  return serializeProject(snapshot, "project-1", "Test Project");
}

function replaceFirstBase64Byte(base64: string, value: number): string {
  const binary = atob(base64);
  return btoa(String.fromCharCode(value) + binary.slice(1));
}
